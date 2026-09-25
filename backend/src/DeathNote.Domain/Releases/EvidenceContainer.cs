using Volo.Abp.BlobStoring;

namespace DeathNote.Releases;

/// <summary>Kho tệp bằng chứng — tách riêng khỏi dữ liệu vault để áp chính sách lưu trữ/xoá riêng.</summary>
[BlobContainerName("evidence")]
public class EvidenceContainer
{
}
