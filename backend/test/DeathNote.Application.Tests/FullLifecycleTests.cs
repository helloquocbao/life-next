using System.Security.Claims;
using System.Text.RegularExpressions;
using DeathNote.Admin;
using DeathNote.AuditTrail;
using DeathNote.EntityFrameworkCore;
using DeathNote.Lifecycle;
using DeathNote.Notifications;
using DeathNote.Owners;
using DeathNote.Releases;
using DeathNote.Trustees;
using DeathNote.TrusteePortal;
using DeathNote.Vaults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Volo.Abp;
using Volo.Abp.Authorization;
using Volo.Abp.Content;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Security.Claims;
using Volo.Abp.Testing;
using Volo.Abp.Uow;
using Xunit;

namespace DeathNote;

/// <summary>
/// TEST TÍCH HỢP TRỌN VÒNG ĐỜI trên PostgreSQL thật:
/// onboarding → thêm người nhắc nhở + người nhận → người nhận tạo khoá, owner niêm phong phần dành cho họ → im lặng
/// → nhắc owner 4 vòng → Grace (chỉ người nhắc nhở được báo) → hết ân hạn → TỰ ĐỘNG bàn giao → người nhận mở hộp nhận;
/// kiểm tra audit log toàn vẹn và bất biến. Kèm kịch bản owner check-in giữa ân hạn thì huỷ toàn bộ.
/// (Phần mật mã phía client đã được kiểm thử riêng trong frontend/packages/crypto.)
/// </summary>
public class FullLifecycleTests : AbpIntegratedTest<DeathNoteApplicationTestModule>
{
    protected override void SetAbpApplicationCreationOptions(AbpApplicationCreationOptions options) => options.UseAutofac();

    private readonly Guid _ownerId = Guid.NewGuid();
    private readonly Guid[] _trusteeUsers = [Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()];
    private readonly Guid _reviewerId = Guid.NewGuid();
    private readonly Guid _approverId = Guid.NewGuid();
    private readonly Guid _superAdminId = Guid.NewGuid();

    private T S<T>() where T : notnull => ServiceProvider.GetRequiredService<T>();

    private IDisposable As(Guid id, string name, params string[] roles)
    {
        var claims = new List<Claim>
        {
            new(AbpClaimTypes.UserId, id.ToString()),
            new(AbpClaimTypes.UserName, name),
            new(AbpClaimTypes.Name, name),
            new(AbpClaimTypes.Email, $"{name}@test.local"),
        };
        claims.AddRange(roles.Select(r => new Claim(AbpClaimTypes.Role, r)));
        return S<ICurrentPrincipalAccessor>().Change(new ClaimsPrincipal(new ClaimsIdentity(claims, "test")));
    }

    private async Task InUow(Func<Task> action)
    {
        using var uow = S<IUnitOfWorkManager>().Begin(requiresNew: true, isTransactional: true);
        await action();
        await uow.CompleteAsync();
    }

    private async Task<OwnerProfile> Owner() => await S<IRepository<OwnerProfile, Guid>>().GetAsync(_ownerId);

    /// <summary>Mô phỏng một nhịp của LifecycleWorker cho owner.</summary>
    private Task Tick() => InUow(async () => await S<LifecycleManager>().ProcessOwnerAsync(await Owner()));

    [Fact]
    public async Task Full_lifecycle_from_onboarding_to_automatic_release()
    {
        var notifier = S<CapturingNotificationSender>();
        var policy = S<LifecyclePolicy>();
        string TokenFor(string email) => Uri.UnescapeDataString(Regex.Match(
            notifier.Sent.Last(m => m.Email == email && m.Subject.Contains("người được uỷ quyền")).HtmlBody, @"token=([^""&]+)").Groups[1].Value);

        // ---------------- 1. Owner thiết lập: 2 người nhắc nhở + 1 người nhận thông tin ----------------
        Guid binhId, chauId, dungId;
        using (As(_ownerId, "an"))
        {
            (await S<IOwnerAppService>().CompleteOnboardingAsync(new CompleteOnboardingInput { DisplayName = "Nguyễn Văn An", CheckInIntervalDays = 7, GraceDays = 7 }))
                .State.ShouldBe(LifecycleState.Active);

            var vault = S<IVaultAppService>();
            await vault.InitializeAsync(new InitializeVaultInput
            {
                KdfSalt = "c2FsdA==", KdfOpsLimit = 3, KdfMemLimit = 64 << 20,
                PassphraseWrappedKey = "wrapped-by-passphrase", RecoveryWrappedKey = "wrapped-by-recovery", RecoverySalt = "cnNhbHQ="
            });
            await vault.CreateItemAsync(new SaveVaultItemInput { Ciphertext = "ciphertext-bank", WrappedItemKey = "wik-1" });
            await vault.CreateItemAsync(new SaveVaultItemInput { Ciphertext = "ciphertext-insurance", WrappedItemKey = "wik-2" });

            var trustees = S<ITrusteeAppService>();
            var binh = await trustees.CreateAsync(new SaveTrusteeInput { DisplayName = "Bình", Email = "binh@test.local", Role = TrusteeRole.Reminder });
            var chau = await trustees.CreateAsync(new SaveTrusteeInput { DisplayName = "Châu", Email = "chau@test.local", Role = TrusteeRole.Reminder });
            var dung = await trustees.CreateAsync(new SaveTrusteeInput { DisplayName = "Dũng", Email = "dung@test.local", Role = TrusteeRole.Recipient });
            (binhId, chauId, dungId) = (binh.Id, chau.Id, dung.Id);
            new[] { binh, chau, dung }.ShouldAllBe(t => t.Status == TrusteeStatus.NotInvitedYet);

            // Người nhận phải được mời SỚM (để tạo khoá trước): owner chủ động mời. Người nhắc nhở thì chưa cần.
            await trustees.ResendInvitationAsync(dungId);
        }
        notifier.Sent.Count(m => m.Subject.Contains("người được uỷ quyền")).ShouldBe(1);

        // ---------------- 2. Người nhận tạo khoá + chấp nhận; owner niêm phong phần dành cho họ ----------------
        using (As(_trusteeUsers[2], "dung"))
        {
            var portal = S<ITrusteePortalAppService>();
            await portal.CreateKeyringAsync(new CreateKeyringInput { PublicKey = "pk-dung", EncryptedPrivateKey = "esk-dung", KdfSalt = "c2FsdA==", KdfOpsLimit = 3, KdfMemLimit = 64 << 20 });
            (await portal.AcceptInvitationAsync(new AcceptInvitationInput { Token = TokenFor("dung@test.local") })).Phase.ShouldBe(TrusteePhase.Normal);
        }
        using (As(_ownerId, "an"))
        {
            var status = await S<IOwnerAppService>().GetStatusAsync();
            status.KeysOutdated.ShouldBeFalse(); // chưa từng phân bổ nên chưa "lỗi thời"

            // Chỉ người nhận thông tin đã sẵn sàng mới nhận được Grant: người nhắc nhở bị từ chối.
            var bad = await Should.ThrowAsync<BusinessException>(() => S<IVaultAppService>().DistributeKeysAsync(new DistributeKeysInput
            {
                EncryptedAllocation = "enc-allocation",
                Grants = [new SealedGrantInput { TrusteeId = binhId, SealedPayload = "grant-for-binh", ItemCount = 1 }]
            }));
            bad.Code.ShouldBe(DeathNoteErrorCodes.InvalidShareDeliveries);

            var vault = await S<IVaultAppService>().DistributeKeysAsync(new DistributeKeysInput
            {
                EncryptedAllocation = "enc-allocation",
                Grants = [new SealedGrantInput { TrusteeId = dungId, SealedPayload = "grant-for-dung", ItemCount = 2 }]
            });
            vault.KeyVersion.ShouldBe(1);
            vault.KeysOutdated.ShouldBeFalse();
            (await S<ITrusteeAppService>().GetListAsync()).Single(t => t.Id == dungId).HasCurrentGrant.ShouldBeTrue();
        }

        // ---------------- 3. Owner im lặng → Missed: chỉ nhắc OWNER; tự mời người nhắc nhở ----------------
        FakeClock.Advance(TimeSpan.FromDays(7.1));
        await Tick();
        (await Owner()).State.ShouldBe(LifecycleState.Missed);
        notifier.Sent.Count(m => m.Subject.Contains("người được uỷ quyền")).ShouldBe(3); // +2 người nhắc nhở, KHÔNG mời thêm người nhận

        foreach (var (user, name, email) in new[] { (_trusteeUsers[0], "binh", "binh@test.local"), (_trusteeUsers[1], "chau", "chau@test.local") })
        {
            using (As(user, name))
            {
                // Người nhắc nhở không cần khoá cá nhân.
                (await S<ITrusteePortalAppService>().AcceptInvitationAsync(new AcceptInvitationInput { Token = TokenFor(email) }))
                    .Phase.ShouldBe(TrusteePhase.Normal);
            }
        }

        // ---------------- 4. Các vòng nhắc → Grace: CHỈ người nhắc nhở được báo ----------------
        for (var i = 0; i < policy.ReminderSteps; i++)
        {
            FakeClock.Advance(policy.ReminderInterval + TimeSpan.FromMinutes(1));
            await Tick();
        }
        (await Owner()).State.ShouldBe(LifecycleState.Grace);
        var graceAlerts = notifier.Sent.Where(m => m.Subject.Contains("nhờ bạn liên lạc")).ToList();
        graceAlerts.Select(m => m.Email).ShouldBe(["binh@test.local", "chau@test.local"], ignoreOrder: true);

        using (As(_trusteeUsers[0], "binh"))
        {
            var portal = S<ITrusteePortalAppService>();
            var a = (await portal.GetAssignmentsAsync()).Single();
            a.Phase.ShouldBe(TrusteePhase.Alert);
            a.ReleaseAt.ShouldNotBeNull();
            await portal.RespondContactAsync(new ContactResponseInput { TrusteeId = binhId, Response = ContactResponse.CannotReach });
            (await portal.GetAssignmentsAsync()).Single().MyContactResponse.ShouldBe(ContactResponse.CannotReach);
            // Người nhắc nhở không có hộp nhận.
            (await Should.ThrowAsync<BusinessException>(() => portal.GetInboxAsync(binhId))).Code.ShouldBe(DeathNoteErrorCodes.NotATrustee);
        }
        using (As(_trusteeUsers[2], "dung"))
        {
            var portal = S<ITrusteePortalAppService>();
            // Người nhận KHÔNG được báo gì trong lúc owner im lặng, và chưa mở được hộp nhận.
            (await portal.GetAssignmentsAsync()).Single().Phase.ShouldBe(TrusteePhase.Normal);
            (await Should.ThrowAsync<BusinessException>(() => portal.GetInboxAsync(dungId))).Code.ShouldBe(DeathNoteErrorCodes.ReleaseNotYetReleased);
            (await Should.ThrowAsync<BusinessException>(() => portal.RespondContactAsync(new ContactResponseInput { TrusteeId = dungId, Response = ContactResponse.CanReach })))
                .Code.ShouldBe(DeathNoteErrorCodes.NotATrustee);
        }
        notifier.Sent.ShouldNotContain(m => m.Email == "dung@test.local" && m.Subject.Contains("sẵn sàng"));

        // Giữa ân hạn vẫn chưa bàn giao.
        FakeClock.Advance(TimeSpan.FromDays(3));
        await Tick();
        (await Owner()).State.ShouldBe(LifecycleState.Grace);

        // ---------------- 5. Hết ân hạn mà owner vẫn im lặng → TỰ ĐỘNG bàn giao ----------------
        FakeClock.Advance(TimeSpan.FromDays(4.1));
        await Tick();
        (await Owner()).State.ShouldBe(LifecycleState.Released);
        notifier.Sent.ShouldContain(m => m.Email == "dung@test.local" && m.Subject.Contains("sẵn sàng"));
        notifier.Sent.ShouldNotContain(m => (m.Email == "binh@test.local" || m.Email == "chau@test.local") && m.Subject.Contains("sẵn sàng"));

        using (As(_trusteeUsers[2], "dung"))
        {
            var portal = S<ITrusteePortalAppService>();
            var inbox = await portal.GetInboxAsync(dungId);
            inbox.SealedGrant.ShouldBe("grant-for-dung");
            inbox.GrantItemCount.ShouldBe(2);
            (await portal.GetAssignmentsAsync()).Single().Phase.ShouldBe(TrusteePhase.Released);
        }
        using (As(_trusteeUsers[0], "binh"))
        {
            var portal = S<ITrusteePortalAppService>();
            (await portal.GetAssignmentsAsync()).Single().Phase.ShouldBe(TrusteePhase.Released);
            (await Should.ThrowAsync<BusinessException>(() => portal.GetInboxAsync(binhId))).Code.ShouldBe(DeathNoteErrorCodes.NotATrustee);
        }

        // Không thể đảo ngược: owner không check-in được nữa và không đổi được phần đã chia.
        using (As(_ownerId, "an"))
        {
            (await Should.ThrowAsync<BusinessException>(() => S<IOwnerAppService>().CheckInAsync(new CheckInInput()))).Code.ShouldBe(DeathNoteErrorCodes.AlreadyReleased);
            (await Should.ThrowAsync<BusinessException>(() => S<IVaultAppService>().DistributeKeysAsync(new DistributeKeysInput())))
                .Code.ShouldBe(DeathNoteErrorCodes.AlreadyReleased);
        }

        // ---------------- 6. Audit log: toàn vẹn + bất biến ----------------
        await InUow(async () =>
        {
            var (total, broken) = await S<AuditTrailManager>().VerifyChainAsync();
            total.ShouldBeGreaterThan(15);
            broken.ShouldBeNull();
        });
        await InUow(async () =>
        {
            var db = await S<Volo.Abp.EntityFrameworkCore.IDbContextProvider<DeathNoteDbContext>>().GetDbContextAsync();
            var ex = await Should.ThrowAsync<Exception>(() => db.Database.ExecuteSqlRawAsync("DELETE FROM \"DnAuditEvents\""));
            ex.Message.ShouldContain("append-only");
        });
    }

    [Fact]
    public async Task Owner_check_in_during_grace_cancels_everything_and_nobody_gets_the_data()
    {
        var notifier = S<CapturingNotificationSender>();
        var policy = S<LifecyclePolicy>();
        var ownerId = Guid.NewGuid();
        var reminderUser = Guid.NewGuid();
        var reminderTrusteeId = Guid.Empty;
        using (As(ownerId, "hoa"))
        {
            await S<IOwnerAppService>().CompleteOnboardingAsync(new CompleteOnboardingInput { DisplayName = "Hoa", CheckInIntervalDays = 7, GraceDays = 7 });
            var t = await S<ITrusteeAppService>().CreateAsync(new SaveTrusteeInput { DisplayName = "Lan", Email = "lan@test.local", Role = TrusteeRole.Reminder });
            reminderTrusteeId = t.Id;
        }
        Task TickHoa() => InUow(async () => await S<LifecycleManager>().ProcessOwnerAsync(await S<IRepository<OwnerProfile, Guid>>().GetAsync(ownerId)));

        FakeClock.Advance(TimeSpan.FromDays(7.1));
        await TickHoa();
        var token = Uri.UnescapeDataString(Regex.Match(notifier.Sent.Last(m => m.Email == "lan@test.local").HtmlBody, @"token=([^""&]+)").Groups[1].Value);
        using (As(reminderUser, "lan"))
            await S<ITrusteePortalAppService>().AcceptInvitationAsync(new AcceptInvitationInput { Token = token });

        for (var i = 0; i < policy.ReminderSteps; i++)
        {
            FakeClock.Advance(policy.ReminderInterval + TimeSpan.FromMinutes(1));
            await TickHoa();
        }
        (await S<IRepository<OwnerProfile, Guid>>().GetAsync(ownerId)).State.ShouldBe(LifecycleState.Grace);

        // Owner bấm "Tôi vẫn ổn" khi còn ân hạn → quay về Active, người nhắc nhở được báo huỷ.
        using (As(ownerId, "hoa"))
        {
            var result = await S<IOwnerAppService>().CheckInAsync(new CheckInInput());
            result.WasVeto.ShouldBeTrue();
            result.PreviousState.ShouldBe(LifecycleState.Grace);
        }
        notifier.Sent.ShouldContain(m => m.Email == "lan@test.local" && m.Subject.Contains("đã xác nhận an toàn"));

        // Dù thời gian có trôi qua bao lâu, không còn gì để bàn giao.
        FakeClock.Advance(TimeSpan.FromDays(3));
        await TickHoa();
        (await S<IRepository<OwnerProfile, Guid>>().GetAsync(ownerId)).State.ShouldBe(LifecycleState.Active);
        using (As(reminderUser, "lan"))
            (await S<ITrusteePortalAppService>().GetAssignmentsAsync()).Single().Phase.ShouldBe(TrusteePhase.Normal);
        _ = reminderTrusteeId;
    }

    [Fact]
    public async Task Owner_check_in_vetoes_an_open_release_request()
    {
        // Dựng nhanh tới Verifying bằng domain rồi để owner check-in qua app service.
        var ownerId = Guid.NewGuid();
        using (As(ownerId, "binh"))
        {
            await S<IOwnerAppService>().CompleteOnboardingAsync(new CompleteOnboardingInput { DisplayName = "Bình", CheckInIntervalDays = 7, GraceDays = 7 });
        }
        await InUow(async () =>
        {
            var owners = S<IRepository<OwnerProfile, Guid>>();
            var o = await owners.GetAsync(ownerId);
            var now = FakeClock.Current.AddDays(8);
            o.MarkMissed(now);
            o.EnterGrace(now);
            o.EnterVerifying(now);
            await owners.UpdateAsync(o);
            await S<IRepository<ReleaseRequest, Guid>>().InsertAsync(new ReleaseRequest(Guid.NewGuid(), ownerId, Guid.NewGuid(), ReleaseReason.LostContact, null, 2, 1, now));
        });

        using (As(ownerId, "binh"))
        {
            var result = await S<IOwnerAppService>().CheckInAsync(new CheckInInput());
            result.WasVeto.ShouldBeTrue();
            result.PreviousState.ShouldBe(LifecycleState.Verifying);
            (await S<IOwnerAppService>().GetStatusAsync()).State.ShouldBe(LifecycleState.Active);
        }
        await InUow(async () =>
        {
            var request = await S<IRepository<ReleaseRequest, Guid>>().FirstAsync(r => r.OwnerId == ownerId);
            request.Status.ShouldBe(ReleaseStatus.CancelledByOwner);
        });
    }

    /// <summary>
    /// Owner quên cả passphrase lẫn 12 từ khôi phục — không có API "quên mật khẩu" nào cứu được
    /// (đúng thiết kế zero-knowledge). Lối thoát duy nhất là từ bỏ két cũ: xoá sạch hạng mục, mảnh khoá,
    /// phân bổ, rồi cho phép tạo két mới — trong khi vẫn giữ nguyên danh sách người được uỷ quyền.
    /// </summary>
    [Fact]
    public async Task Owner_can_abandon_a_locked_out_vault_and_create_a_new_one()
    {
        var ownerId = Guid.NewGuid();
        var trusteeId = Guid.NewGuid();
        using (As(ownerId, "chau"))
        {
            await S<IOwnerAppService>().CompleteOnboardingAsync(new CompleteOnboardingInput { DisplayName = "Châu", CheckInIntervalDays = 30, GraceDays = 14 });
            await S<IVaultAppService>().InitializeAsync(new InitializeVaultInput
            {
                KdfSalt = "c2FsdA==", KdfOpsLimit = 3, KdfMemLimit = 64 << 20,
                PassphraseWrappedKey = "wrapped-old", RecoveryWrappedKey = "recovery-old", RecoverySalt = "cnNhbHQ="
            });
            var item = await S<IVaultAppService>().CreateItemAsync(new SaveVaultItemInput { Ciphertext = "old-secret", WrappedItemKey = "wik" });
            var trustee = await S<ITrusteeAppService>().CreateAsync(new SaveTrusteeInput { DisplayName = "Dũng", Email = "d@test.local", Role = TrusteeRole.Recipient });
            trusteeId = trustee.Id;

            // Quên cả 2 chìa → từ bỏ két.
            await S<IVaultAppService>().AbandonAsync();

            // Vault cũ đã biến mất hoàn toàn — tạo lại được ngay, không còn hạng mục cũ.
            var status = await S<IOwnerAppService>().GetStatusAsync();
            status.VaultInitialized.ShouldBeFalse();
            status.RecoveryKitConfirmed.ShouldBeFalse();

            var newVault = await S<IVaultAppService>().InitializeAsync(new InitializeVaultInput
            {
                KdfSalt = "bmV3", KdfOpsLimit = 3, KdfMemLimit = 64 << 20,
                PassphraseWrappedKey = "wrapped-new", RecoveryWrappedKey = "recovery-new", RecoverySalt = "bmV3c2FsdA=="
            });
            newVault.PassphraseWrappedKey.ShouldBe("wrapped-new");
            (await S<IVaultAppService>().GetItemsAsync()).ShouldBeEmpty(); // hạng mục cũ không còn

            // Người được uỷ quyền vẫn còn nguyên — owner không cần mời lại.
            (await S<ITrusteeAppService>().GetListAsync()).ShouldContain(t => t.Id == trusteeId);

            _ = item;
        }

        // Không thể từ bỏ hai lần liên tiếp nếu chưa có két nào để bỏ.
        using (As(Guid.NewGuid(), "chua-co-ket"))
        {
            var ex = await Should.ThrowAsync<BusinessException>(() => S<IVaultAppService>().AbandonAsync());
            ex.Code.ShouldBe(DeathNoteErrorCodes.VaultNotInitialized);
        }
    }
}
