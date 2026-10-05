using DeathNote.AuditTrail;
using DeathNote.Notifications;
using DeathNote.Owners;
using DeathNote.Releases;
using DeathNote.Trustees;
using DeathNote.Vaults;
using Microsoft.EntityFrameworkCore;
using Volo.Abp.AuditLogging.EntityFrameworkCore;
using Volo.Abp.Data;
using Volo.Abp.EntityFrameworkCore;
using Volo.Abp.EntityFrameworkCore.Modeling;
using Volo.Abp.Identity.EntityFrameworkCore;
using Volo.Abp.OpenIddict.EntityFrameworkCore;
using Volo.Abp.PermissionManagement.EntityFrameworkCore;
using Volo.Abp.SettingManagement.EntityFrameworkCore;

namespace DeathNote.EntityFrameworkCore;

/// <summary>
/// DbContext chính (PostgreSQL). Chứa cả bảng của các module ABP (Identity, OpenIddict, Permission…)
/// để một bộ migration duy nhất quản lý toàn bộ schema.
/// <para>
/// Lưu ý zero-knowledge: các cột *Ciphertext / *Wrapped* / Sealed* chỉ chứa chuỗi base64 đã mã hoá
/// phía client; CSDL không có bất kỳ cột nào chứa nội dung vault ở dạng rõ.
/// </para>
/// </summary>
[ConnectionStringName("Default")]
public class DeathNoteDbContext : AbpDbContext<DeathNoteDbContext>
{
    public DbSet<OwnerProfile> OwnerProfiles { get; set; }
    public DbSet<Heartbeat> Heartbeats { get; set; }
    public DbSet<Vault> Vaults { get; set; }
    public DbSet<VaultItem> VaultItems { get; set; }
    public DbSet<KeyShare> KeyShares { get; set; }
    public DbSet<Grant> Grants { get; set; }
    public DbSet<Trustee> Trustees { get; set; }
    public DbSet<UserKeyring> UserKeyrings { get; set; }
    public DbSet<ReleaseRequest> ReleaseRequests { get; set; }
    public DbSet<AuditEvent> AuditEvents { get; set; }
    public DbSet<EmailTemplate> EmailTemplates { get; set; }

    public DeathNoteDbContext(DbContextOptions<DeathNoteDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Bảng của các module ABP
        builder.ConfigurePermissionManagement();
        builder.ConfigureSettingManagement();
        builder.ConfigureAuditLogging();
        builder.ConfigureIdentity();
        builder.ConfigureOpenIddict();

        // Bảng nghiệp vụ Death Note (tiền tố "Dn")
        const string p = DeathNoteConsts.DbTablePrefix;
        const string? s = DeathNoteConsts.DbSchema;

        builder.Entity<EmailTemplate>(b =>
        {
            b.ToTable(p + "EmailTemplates", s);
            b.ConfigureByConvention();
            b.Property(x => x.Key).HasMaxLength(EmailTemplateKeys.MaxKeyLength).IsRequired();
            b.Property(x => x.Subject).HasMaxLength(EmailTemplateKeys.MaxSubjectLength).IsRequired();
            b.Property(x => x.BodyHtml).IsRequired(); // text
            b.HasIndex(x => x.Key).IsUnique();
        });

        builder.Entity<OwnerProfile>(b =>
        {
            b.ToTable(p + "OwnerProfiles", s);
            b.ConfigureByConvention();
            b.Property(x => x.DisplayName).HasMaxLength(128).IsRequired();
            b.Property(x => x.Email).HasMaxLength(256).IsRequired();
            b.Property(x => x.PhoneNumber).HasMaxLength(32);
            b.Property(x => x.PauseReason).HasMaxLength(256);
            b.Property(x => x.CheckInLinkNonce).HasMaxLength(64).IsRequired();
            // Worker quét theo (State, NextCheckInDueAt) mỗi chu kỳ.
            b.HasIndex(x => new { x.State, x.NextCheckInDueAt });
        });

        builder.Entity<Heartbeat>(b =>
        {
            b.ToTable(p + "Heartbeats", s);
            b.ConfigureByConvention();
            b.Property(x => x.IpAddress).HasMaxLength(64);
            b.Property(x => x.UserAgent).HasMaxLength(512);
            b.HasIndex(x => new { x.OwnerId, x.OccurredAt });
        });

        builder.Entity<Vault>(b =>
        {
            b.ToTable(p + "Vaults", s);
            b.ConfigureByConvention();
            b.Ignore(x => x.OwnerId);
            b.Property(x => x.KdfSalt).HasMaxLength(128).IsRequired();
            b.Property(x => x.RecoverySalt).HasMaxLength(128).IsRequired();
            b.Property(x => x.PassphraseWrappedKey).HasMaxLength(512).IsRequired();
            b.Property(x => x.RecoveryWrappedKey).HasMaxLength(512).IsRequired();
            b.Property(x => x.WrappedReleaseKey).HasMaxLength(512);
            b.Property(x => x.EncryptedAllocation); // text
        });

        builder.Entity<VaultItem>(b =>
        {
            b.ToTable(p + "VaultItems", s);
            b.ConfigureByConvention();
            b.Property(x => x.Ciphertext).IsRequired(); // text
            b.Property(x => x.WrappedItemKey).HasMaxLength(512).IsRequired();
            b.HasIndex(x => x.OwnerId);
        });

        builder.Entity<KeyShare>(b =>
        {
            b.ToTable(p + "KeyShares", s);
            b.ConfigureByConvention();
            b.Property(x => x.SealedShare).HasMaxLength(1024).IsRequired();
            b.HasIndex(x => new { x.OwnerId, x.KeyVersion });
            b.HasIndex(x => x.TrusteeId);
        });

        builder.Entity<Grant>(b =>
        {
            b.ToTable(p + "Grants", s);
            b.ConfigureByConvention();
            b.Property(x => x.SealedPayload).IsRequired();
            b.Property(x => x.EscrowedKey).HasMaxLength(512);
            b.HasIndex(x => new { x.OwnerId, x.KeyVersion });
            b.HasIndex(x => x.TrusteeId);
        });

        builder.Entity<Trustee>(b =>
        {
            b.ToTable(p + "Trustees", s);
            b.ConfigureByConvention();
            b.Property(x => x.DisplayName).HasMaxLength(128).IsRequired();
            b.Property(x => x.Email).HasMaxLength(256).IsRequired();
            b.Property(x => x.PhoneNumber).HasMaxLength(32);
            b.Property(x => x.Relationship).HasMaxLength(64);
            b.Property(x => x.PublicKey).HasMaxLength(128);
            b.Property(x => x.InvitationTokenHash).HasMaxLength(128);
            b.HasIndex(x => x.OwnerId);
            b.HasIndex(x => x.UserId);
            b.HasIndex(x => x.InvitationTokenHash);
        });

        builder.Entity<UserKeyring>(b =>
        {
            b.ToTable(p + "UserKeyrings", s);
            b.ConfigureByConvention();
            b.Property(x => x.PublicKey).HasMaxLength(128).IsRequired();
            b.Property(x => x.EncryptedPrivateKey).HasMaxLength(512).IsRequired();
            b.Property(x => x.KdfSalt).HasMaxLength(128).IsRequired();
        });

        builder.Entity<ReleaseRequest>(b =>
        {
            b.ToTable(p + "ReleaseRequests", s);
            b.ConfigureByConvention();
            b.Property(x => x.Statement).HasMaxLength(4000);
            b.Property(x => x.InfoRequestNote).HasMaxLength(2000);
            b.Property(x => x.CloseNote).HasMaxLength(2000);
            b.HasMany(x => x.Consents).WithOne().HasForeignKey(x => x.ReleaseRequestId).IsRequired();
            b.HasMany(x => x.ShareDeliveries).WithOne().HasForeignKey(x => x.ReleaseRequestId).IsRequired();
            b.HasMany(x => x.Evidence).WithOne().HasForeignKey(x => x.ReleaseRequestId).IsRequired();
            b.HasMany(x => x.Votes).WithOne().HasForeignKey(x => x.ReleaseRequestId).IsRequired();
            b.HasIndex(x => new { x.OwnerId, x.Status });
            b.HasIndex(x => x.Status);
        });

        builder.Entity<ReleaseConsent>(b =>
        {
            b.ToTable(p + "ReleaseConsents", s);
            b.ConfigureByConvention();
            b.Property(x => x.IpAddress).HasMaxLength(64);
            b.Property(x => x.UserAgent).HasMaxLength(512);
            b.Property(x => x.Statement).HasMaxLength(2000);
        });

        builder.Entity<ShareDelivery>(b =>
        {
            b.ToTable(p + "ShareDeliveries", s);
            b.ConfigureByConvention();
            b.Property(x => x.SealedShare).HasMaxLength(1024).IsRequired();
            b.HasIndex(x => x.ToTrusteeId);
        });

        builder.Entity<ReleaseEvidence>(b =>
        {
            b.ToTable(p + "ReleaseEvidence", s);
            b.ConfigureByConvention();
            b.Property(x => x.FileName).HasMaxLength(256).IsRequired();
            b.Property(x => x.ContentType).HasMaxLength(128).IsRequired();
            b.Property(x => x.BlobName).HasMaxLength(256).IsRequired();
        });

        builder.Entity<ReviewVote>(b =>
        {
            b.ToTable(p + "ReviewVotes", s);
            b.ConfigureByConvention();
            b.Property(x => x.AdminName).HasMaxLength(256).IsRequired();
            b.Property(x => x.Note).HasMaxLength(2000);
        });

        builder.Entity<AuditEvent>(b =>
        {
            b.ToTable(p + "AuditEvents", s);
            b.ConfigureByConvention();
            b.Property(x => x.Action).HasMaxLength(64).IsRequired();
            b.Property(x => x.ActorName).HasMaxLength(256);
            b.Property(x => x.TargetType).HasMaxLength(64);
            b.Property(x => x.TargetId).HasMaxLength(64);
            b.Property(x => x.Detail).HasMaxLength(2000);
            b.Property(x => x.IpAddress).HasMaxLength(64);
            b.Property(x => x.PreviousHash).HasMaxLength(64).IsRequired();
            b.Property(x => x.Hash).HasMaxLength(64).IsRequired();
            b.HasIndex(x => x.Sequence).IsUnique();
            b.HasIndex(x => new { x.OwnerId, x.Sequence });
            b.HasIndex(x => new { x.TrusteeId, x.Sequence });
        });
    }
}
