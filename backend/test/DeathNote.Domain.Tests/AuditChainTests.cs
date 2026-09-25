using System.Reflection;
using DeathNote.AuditTrail;
using Shouldly;
using Xunit;

namespace DeathNote;

/// <summary>Chuỗi băm của audit log phát hiện mọi chỉnh sửa trái phép.</summary>
public class AuditChainTests
{
    [Fact]
    public void Tampering_changes_the_hash()
    {
        var ctor = typeof(AuditEvent).GetConstructors(BindingFlags.NonPublic | BindingFlags.Instance)
            .First(c => c.GetParameters().Length == 6);
        var evt = (AuditEvent)ctor.Invoke([Guid.NewGuid(), 1L, DateTime.UtcNow, AuditEvent.GenesisHash,
            new AuditEntry("owner.check_in", Guid.NewGuid(), Detail: "Kênh: Web"), "127.0.0.1"]);

        evt.ComputeHash().ShouldBe(evt.Hash);

        // Giả lập kẻ xấu sửa trực tiếp cột Detail trong CSDL
        typeof(AuditEvent).GetProperty(nameof(AuditEvent.Detail))!.SetValue(evt, "Kênh: EmailLink");
        evt.ComputeHash().ShouldNotBe(evt.Hash);
    }
}
