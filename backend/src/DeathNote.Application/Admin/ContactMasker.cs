namespace DeathNote.Admin;

/// <summary>Che thông tin liên hệ khách hàng khi hiển thị cho nhân viên: đủ để nhận ra, không đủ để liên lạc.</summary>
public static class ContactMasker
{
    private const string Dots = "•••";

    /// <summary>"nguyenvana@gmail.com" → "ng•••@gmail.com" (giữ tối đa 2 ký tự đầu và tên miền).</summary>
    public static string Email(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0) return Dots;
        return email[..Math.Min(2, at)] + Dots + email[at..];
    }

    /// <summary>"0901234789" → "•••••••789" (chỉ giữ 3 số cuối).</summary>
    public static string? Phone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var p = phone.Trim();
        return p.Length <= 3 ? Dots : new string('•', p.Length - 3) + p[^3..];
    }
}
