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
/// onboarding → mời 3 trustee → phân mảnh 2-of-3 → im lặng → nhắc 4 vòng → Grace → chờ hết ân hạn
/// → trustee khởi tạo + nộp bằng chứng → 2 người đồng thuận (khác IP) → quy tắc 4 mắt → chờ cuối
/// → phát hành → trustee thứ 3 mở hộp nhận; kiểm tra audit log toàn vẹn và bất biến.
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
    public async Task Full_lifecycle_from_onboarding_to_release()
    {
        var notifier = S<CapturingNotificationSender>();
        var policy = S<LifecyclePolicy>();

        // ---------------- 1. Owner thiết lập ----------------
        // Owner thêm 3 người thân nhưng KHÔNG muốn họ biết trước — hệ thống chỉ gửi lời mời thật khi
        // owner thật sự bỏ lỡ xác nhận (Missed), xem TrusteeAppService.CreateAsync/LifecycleManager.
        var tokens = new List<string>();
        var trusteeIds = new List<Guid>();
        using (As(_ownerId, "an"))
        {
            var owner = S<IOwnerAppService>();
            (await owner.CompleteOnboardingAsync(new CompleteOnboardingInput { DisplayName = "Nguyễn Văn An", CheckInIntervalDays = 7, GraceDays = 7 }))
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
            foreach (var (name, i) in new[] { "Bình", "Châu", "Dũng" }.Select((n, i) => (n, i)))
            {
                var t = await trustees.CreateAsync(new SaveTrusteeInput { DisplayName = name, Email = $"t{i}@test.local", Role = TrusteeRole.KeyHolder });
                t.Status.ShouldBe(TrusteeStatus.NotInvitedYet);
                trusteeIds.Add(t.Id);
            }
        }
        // Chưa gửi lời mời nào — chưa đến hạn.
        notifier.Sent.Count(m => m.Subject.Contains("người được uỷ quyền")).ShouldBe(0);

        // ---------------- 2. Owner im lặng → Missed: hệ thống TỰ ĐỘNG gửi lời mời lúc này ----------------
        FakeClock.Advance(TimeSpan.FromDays(7.1));
        await Tick();
        (await Owner()).State.ShouldBe(LifecycleState.Missed);
        foreach (var m in notifier.Sent.Where(m => m.Subject.Contains("người được uỷ quyền")))
            tokens.Add(Uri.UnescapeDataString(Regex.Match(m.HtmlBody, @"token=([^""&]+)").Groups[1].Value));
        tokens.Count.ShouldBe(3);

        // ---------------- 3. Trustee chấp nhận + tạo khoá ----------------
        for (var i = 0; i < 3; i++)
        {
            using (As(_trusteeUsers[i], $"trustee{i}"))
            {
                var portal = S<ITrusteePortalAppService>();
                await portal.CreateKeyringAsync(new CreateKeyringInput { PublicKey = $"pk-{i}", EncryptedPrivateKey = $"esk-{i}", KdfSalt = "c2FsdA==", KdfOpsLimit = 3, KdfMemLimit = 64 << 20 });
                (await portal.AcceptInvitationAsync(new AcceptInvitationInput { Token = tokens[i] })).Phase.ShouldBe(TrusteePhase.Normal);
            }
        }

        // ---------------- 4. Owner phân mảnh 2-of-3 (vẫn còn cơ hội trong lúc Missed, trước khi hết vòng nhắc) ----------------
        using (As(_ownerId, "an"))
        {
            var vault = await S<IVaultAppService>().DistributeKeysAsync(new DistributeKeysInput
            {
                Threshold = 2,
                WrappedReleaseKey = "wrapped-release-key",
                EncryptedAllocation = "enc-allocation",
                Shares = trusteeIds.Select((id, i) => new SealedShareInput { TrusteeId = id, SealedShare = $"share-for-{i}" }).ToList(),
                Grants = [new SealedGrantInput { TrusteeId = trusteeIds[2], SealedPayload = "grant-for-dung", ItemCount = 2 }]
            });
            vault.Threshold.ShouldBe(2);
            vault.KeyHolderCount.ShouldBe(3);
            (await S<IOwnerAppService>().GetStatusAsync()).Readiness.Score.ShouldBeGreaterThan(50);
        }

        // ---------------- 5. 4 vòng nhắc còn lại → Grace ----------------
        for (var i = 0; i < policy.ReminderSteps; i++)
        {
            FakeClock.Advance(policy.ReminderInterval + TimeSpan.FromMinutes(1));
            await Tick();
        }
        (await Owner()).State.ShouldBe(LifecycleState.Grace);
        notifier.Sent.Count(m => m.Subject.Contains("chưa check-in")).ShouldBe(3); // cả 3 trustee được báo

        // Trong thời gian ân hạn: chưa được khởi tạo yêu cầu mở (cổng thời gian).
        using (As(_trusteeUsers[0], "trustee0"))
        {
            var ex = await Should.ThrowAsync<BusinessException>(() => S<ITrusteePortalAppService>().InitiateReleaseAsync(
                new InitiateReleaseInput { TrusteeId = trusteeIds[0], Reason = ReleaseReason.Deceased }));
            ex.Code.ShouldBe(DeathNoteErrorCodes.ReleaseNotAllowedInState);
        }

        // ---------------- 5. Hết ân hạn → trustee khởi tạo + nộp bằng chứng ----------------
        FakeClock.Advance(TimeSpan.FromDays(7.1));
        Guid requestId;
        using (As(_trusteeUsers[0], "trustee0"))
        {
            var portal = S<ITrusteePortalAppService>();
            var progress = await portal.InitiateReleaseAsync(new InitiateReleaseInput { TrusteeId = trusteeIds[0], Reason = ReleaseReason.Deceased, Statement = "Tôi xác nhận…" });
            requestId = progress.Id;
            progress.RequiredConsents.ShouldBe(2);
            await portal.UploadEvidenceAsync(requestId, EvidenceKind.DeathCertificate,
                new RemoteStreamContent(new MemoryStream("PDF"u8.ToArray()), "giay-chung-tu.pdf", "application/pdf"));
        }
        (await Owner()).State.ShouldBe(LifecycleState.Verifying);
        notifier.Sent.ShouldContain(m => m.Subject.StartsWith("Cảnh báo") && m.Channels == NotificationChannels.All);

        // ---------------- 6. Đồng thuận m-of-n (chống trùng IP) ----------------
        await ConsentAs(0, trusteeIds, requestId, "10.0.0.1");
        await ConsentAs(1, trusteeIds, requestId, "10.0.0.1"); // cùng IP → chỉ tính 1 phiếu
        (await Owner()).State.ShouldBe(LifecycleState.Verifying);
        using (As(_trusteeUsers[1], "trustee1"))
        {
            (await Should.ThrowAsync<BusinessException>(() => ConsentAs(1, trusteeIds, requestId, "10.0.0.2"))).Code.ShouldBe(DeathNoteErrorCodes.AlreadyConsented);
        }
        await ConsentAs(2, trusteeIds, requestId, "10.0.0.3");
        (await Owner()).State.ShouldBe(LifecycleState.Review);

        // ---------------- 7. Thẩm định 4 mắt ----------------
        using (As(_superAdminId, "admin", DeathNoteConsts.Roles.SuperAdmin))
        {
            var ex = await Should.ThrowAsync<BusinessException>(() => S<IReleaseReviewAppService>().VoteAsync(requestId, new CastVoteInput { Decision = ReviewDecision.Approve }));
            ex.Code.ShouldBe(DeathNoteErrorCodes.SuperAdminCannotApprove);
        }
        using (As(_approverId, "approver", DeathNoteConsts.Roles.Approver))
        {
            // Approver không được bỏ phiếu 1
            await Should.ThrowAsync<AbpAuthorizationException>(() => S<IReleaseReviewAppService>().VoteAsync(requestId, new CastVoteInput { Decision = ReviewDecision.Approve }));
        }
        using (As(_reviewerId, "reviewer", DeathNoteConsts.Roles.Reviewer))
        {
            var review = S<IReleaseReviewAppService>();
            var c = await review.GetAsync(requestId);
            c.MyVoteStage.ShouldBe(1);
            c.Summary.Gates.Select(g => g.Code).ShouldBe(["time", "human", "evidence", "crypto"]);
            c.Summary.Gates.ShouldAllBe(g => g.Passed);
            c.RiskFlags.ShouldNotContain(f => f.Code == "NO_EVIDENCE"); // đã nộp giấy chứng tử
            c.RiskFlags.ShouldContain(f => f.Code == "SAME_IP" && f.Severity == RiskSeverity.High); // 2 trustee cùng IP bị gắn cờ
            c.EffectiveConsents.ShouldBe(2);                                                         // 3 phiếu nhưng chỉ tính 2 IP khác nhau
            (await review.VoteAsync(requestId, new CastVoteInput { Decision = ReviewDecision.Approve })).Status.ShouldBe(ReleaseStatus.AwaitingSecondReview);
            await Should.ThrowAsync<Exception>(() => review.VoteAsync(requestId, new CastVoteInput { Decision = ReviewDecision.Approve }));
            (await review.GetEvidenceFileAsync(c.Evidence[0].Id)).FileName.ShouldBe("giay-chung-tu.pdf");
        }
        using (As(_approverId, "approver", DeathNoteConsts.Roles.Approver))
        {
            var c = await S<IReleaseReviewAppService>().VoteAsync(requestId, new CastVoteInput { Decision = ReviewDecision.Approve });
            c.Status.ShouldBe(ReleaseStatus.FinalWait);
        }
        (await Owner()).State.ShouldBe(LifecycleState.FinalWait);
        notifier.Sent.ShouldContain(m => m.Subject.StartsWith("CẢNH BÁO CUỐI"));

        // Trustee chưa mở được hộp nhận trong thời gian chờ cuối.
        using (As(_trusteeUsers[2], "trustee2"))
        {
            (await Should.ThrowAsync<BusinessException>(() => S<ITrusteePortalAppService>().GetInboxAsync(trusteeIds[2])))
                .Code.ShouldBe(DeathNoteErrorCodes.ReleaseNotYetReleased);
        }

        // ---------------- 8. Hết chờ cuối → phát hành ----------------
        FakeClock.Advance(policy.FinalWait + TimeSpan.FromMinutes(1));
        await InUow(async () =>
        {
            var releases = S<IRepository<ReleaseRequest, Guid>>();
            var r = await releases.GetAsync(requestId);
            r.IsFinalWaitOver(FakeClock.Current).ShouldBeTrue();
            await S<ReleaseManager>().CompleteAsync(r);
        });
        (await Owner()).State.ShouldBe(LifecycleState.Released);

        // ---------------- 9. Trustee thứ 3 mở hộp nhận ----------------
        using (As(_trusteeUsers[2], "trustee2"))
        {
            var portal = S<ITrusteePortalAppService>();
            var inbox = await portal.GetInboxAsync(trusteeIds[2]);
            inbox.Threshold.ShouldBe(2);
            inbox.SealedShares.Count.ShouldBeGreaterThanOrEqualTo(2); // mảnh riêng + mảnh các trustee khác chuyển
            inbox.SealedShares.ShouldContain("share-for-2");
            inbox.SealedGrant.ShouldBe("grant-for-dung");
            (await portal.GetAssignmentsAsync()).Single().Phase.ShouldBe(TrusteePhase.Released);
        }

        // ---------------- 10. Audit log: toàn vẹn + bất biến ----------------
        await InUow(async () =>
        {
            var (total, broken) = await S<AuditTrailManager>().VerifyChainAsync();
            total.ShouldBeGreaterThan(20);
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
            var trustee = await S<ITrusteeAppService>().CreateAsync(new SaveTrusteeInput { DisplayName = "Dũng", Email = "d@test.local", Role = TrusteeRole.KeyHolder });
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

    /// <summary>Trustee đồng thuận từ một "thiết bị" (IP) và chuyển mảnh khoá cho 2 người còn lại.</summary>
    private async Task ConsentAs(int i, List<Guid> trusteeIds, Guid requestId, string ip)
    {
        FakeRequestContext.CurrentIp = ip;
        using (As(_trusteeUsers[i], $"trustee{i}"))
        {
            var portal = S<ITrusteePortalAppService>();
            var material = await portal.GetConsentMaterialAsync(requestId);
            material.MySealedShare.ShouldBe($"share-for-{i}");
            material.Recipients.Count.ShouldBe(2);
            await portal.ConsentAsync(requestId, new ConsentInput
            {
                Deliveries = material.Recipients.Select(r => new ShareDeliveryInput { ToTrusteeId = r.TrusteeId, SealedShare = $"resealed-{i}-to-{r.TrusteeId}" }).ToList()
            });
        }
    }
}
