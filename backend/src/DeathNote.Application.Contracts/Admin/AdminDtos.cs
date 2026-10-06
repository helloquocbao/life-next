using System.ComponentModel.DataAnnotations;
using DeathNote.Lifecycle;
using Volo.Abp.Application.Dtos;

namespace DeathNote.Admin;

/// <summary>Dashboard vận hành — CHỈ số liệu tổng hợp, không danh tính.</summary>
public class AdminDashboardDto
{
    public int OwnersActive { get; set; }
    public int OwnersMissed { get; set; }
    public int OwnersInGrace { get; set; }
    public int OwnersReleased { get; set; }
    public int TotalOwners { get; set; }
    public int TotalVaultItems { get; set; }
    public long TotalVaultBytes { get; set; }
    public int AuditEvents24h { get; set; }
    public List<StateCountDto> StateBreakdown { get; set; } = new();
}

public class StateCountDto
{
    public LifecycleState State { get; set; }
    public int Count { get; set; }
}

public class GetCustomersInput : PagedResultRequestDto
{
    /// <summary>Tìm theo tên, email hoặc số điện thoại.</summary>
    public string? Filter { get; set; }
    public LifecycleState? State { get; set; }
}

public class CustomerDto
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = default!;
    /// <summary>Luôn bị che (vd. "ng•••@gmail.com") — xem đầy đủ qua <c>GetContactAsync</c> nếu có quyền.</summary>
    public string MaskedEmail { get; set; } = default!;
    /// <summary>Luôn bị che (vd. "•••••••789").</summary>
    public string? MaskedPhoneNumber { get; set; }
    public LifecycleState State { get; set; }
    public DateTime StateChangedAt { get; set; }
    public DateTime? LastCheckInAt { get; set; }
    public DateTime NextCheckInDueAt { get; set; }
    public int CheckInIntervalDays { get; set; }
    public int GraceDays { get; set; }
    public DateTime? PausedUntil { get; set; }
    public int TrusteeCount { get; set; }
    public int VaultItemCount { get; set; }
    public DateTime CreationTime { get; set; }
}

/// <summary>Email & SĐT đầy đủ của một khách hàng — chỉ trả khi có quyền Customers.ViewContact, mỗi lần gọi ghi audit.</summary>
public class CustomerContactDto
{
    public string Email { get; set; } = default!;
    public string? PhoneNumber { get; set; }
}

public class GetStaffInput : PagedResultRequestDto
{
    /// <summary>Tìm theo tên đăng nhập, họ tên hoặc email.</summary>
    public string? Filter { get; set; }
    public string? Role { get; set; }
}

public class StaffDto
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = default!;
    public string? Name { get; set; }
    public string Email { get; set; } = default!;
    public List<string> Roles { get; set; } = new();
    public bool IsActive { get; set; }
    public DateTime CreationTime { get; set; }
}

public class CreateStaffInput
{
    [Required, StringLength(64)] public string UserName { get; set; } = default!;
    [StringLength(64)] public string? Name { get; set; }
    [Required, EmailAddress, StringLength(256)] public string Email { get; set; } = default!;
    [Required, StringLength(128, MinimumLength = 6)] public string Password { get; set; } = default!;
    [Required, MinLength(1)] public string[] Roles { get; set; } = [];
}

public class UpdateStaffInput
{
    [StringLength(64)] public string? Name { get; set; }
    [Required, EmailAddress, StringLength(256)] public string Email { get; set; } = default!;
    [Required, MinLength(1)] public string[] Roles { get; set; } = [];
    public bool IsActive { get; set; } = true;
    /// <summary>Để trống = giữ mật khẩu cũ.</summary>
    [StringLength(128, MinimumLength = 6)] public string? NewPassword { get; set; }
}

public class RoleDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    /// <summary>Vai trò hệ thống (admin): luôn toàn quyền, không sửa/xoá được.</summary>
    public bool IsStatic { get; set; }
    public int UserCount { get; set; }
    public List<string> Permissions { get; set; } = new();
}

/// <summary>Một quyền trong cây quyền của console (ParentName = null → quyền gốc).</summary>
public class PermissionItemDto
{
    public string Name { get; set; } = default!;
    public string DisplayName { get; set; } = default!;
    public string? ParentName { get; set; }
}

public class SaveRoleInput
{
    [Required, StringLength(64, MinimumLength = 2)] public string Name { get; set; } = default!;
    public string[] Permissions { get; set; } = [];
}

public class GetAuditLogInput : PagedResultRequestDto
{
    public Guid? OwnerId { get; set; }
    /// <summary>
    /// Tiền tố mã hành động (vd. "owner."). KHÔNG đặt tên "Action": MVC bind nhầm route value "action" (= tên hàm GetList)
    /// vào thuộc tính đó → mọi truy vấn bị lọc theo "GetList…" và luôn rỗng.
    /// </summary>
    public string? ActionPrefix { get; set; }
}

public class ChainVerificationDto
{
    public long TotalEvents { get; set; }
    public bool IsIntact { get; set; }
    public long? FirstBrokenSequence { get; set; }
    public DateTime CheckedAt { get; set; }
}

public class PolicyDto
{
    public int MissedPhaseDays { get; set; }
    public string[] ReminderChannels { get; set; } = [];
    public int DefaultGraceDays { get; set; }
    public int MinGraceDays { get; set; }
    public int MaxGraceDays { get; set; }
    public int MaxPauseDays { get; set; }
    public double TimeScale { get; set; }
    public int[] AllowedCheckInIntervals { get; set; } = [];
    /// <summary>Kênh nhắc hợp lệ để chọn trên form chỉnh sửa.</summary>
    public string[] AvailableReminderChannels { get; set; } = [];
}

/// <summary>Chỉnh chính sách vòng đời — có hiệu lực ngay, không cần duyệt.</summary>
public class UpdatePolicyInput
{
    [Range(1, 90)] public int MissedPhaseDays { get; set; }
    [Required, MinLength(1)] public string[] ReminderChannels { get; set; } = [];
    [Range(1, 365)] public int DefaultGraceDays { get; set; }
    [Range(1, 365)] public int MinGraceDays { get; set; }
    [Range(1, 365)] public int MaxGraceDays { get; set; }
    [Range(1, 365)] public int MaxPauseDays { get; set; }
}

/// <summary>Quyền của admin đang đăng nhập — admin console dùng để ẩn/hiện menu.</summary>
public class AdminProfileDto
{
    public string UserName { get; set; } = default!;
    public string? Name { get; set; }
    public List<string> Roles { get; set; } = new();
    public List<string> GrantedPermissions { get; set; } = new();
    public bool IsSuperAdmin { get; set; }
    /// <summary>Hệ số nén thời gian (demo) — console hiển thị dải cảnh báo khi &gt; 1.</summary>
    public double TimeScale { get; set; }
    public DateTime ServerNow { get; set; }
}
