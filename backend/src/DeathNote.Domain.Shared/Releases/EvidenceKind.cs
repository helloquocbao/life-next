namespace DeathNote.Releases;

/// <summary>Loại bằng chứng bên ngoài trustee nộp kèm yêu cầu mở.</summary>
public enum EvidenceKind
{
    DeathCertificate = 0,
    HospitalRecord = 1,
    IdentityDocument = 2,
    SignedStatement = 3,
    Other = 9
}
