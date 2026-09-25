using Volo.Abp.Domain.Entities;

namespace DeathNote.Releases;

/// <summary>
/// Tệp bằng chứng (giấy chứng tử, giấy nhập viện, CCCD…). Đây là dữ liệu DUY NHẤT mà admin được
/// xem nội dung — để thẩm định. Lưu có thời hạn và tự xoá sau khi đóng hồ sơ.
/// </summary>
public class ReleaseEvidence : Entity<Guid>
{
    public Guid ReleaseRequestId { get; private set; }
    public Guid UploadedByTrusteeId { get; private set; }
    public EvidenceKind Kind { get; private set; }
    public string FileName { get; private set; } = default!;
    public string ContentType { get; private set; } = default!;
    public long SizeBytes { get; private set; }
    /// <summary>Tên blob trong kho lưu trữ tệp (container "evidence").</summary>
    public string BlobName { get; private set; } = default!;
    public DateTime UploadedAt { get; private set; }
    /// <summary>Thời điểm tệp đã bị xoá theo chính sách lưu trữ (metadata vẫn giữ để audit).</summary>
    public DateTime? PurgedAt { get; private set; }

    protected ReleaseEvidence() { }

    internal ReleaseEvidence(Guid id, Guid requestId, Guid trusteeId, EvidenceKind kind, string fileName, string contentType,
        long size, string blobName, DateTime at) : base(id)
    {
        ReleaseRequestId = requestId;
        UploadedByTrusteeId = trusteeId;
        Kind = kind;
        FileName = fileName.Length > 256 ? fileName[..256] : fileName;
        ContentType = contentType;
        SizeBytes = size;
        BlobName = blobName;
        UploadedAt = at;
    }

    internal void MarkPurged(DateTime at) => PurgedAt = at;
}
