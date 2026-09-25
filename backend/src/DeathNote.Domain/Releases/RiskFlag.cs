namespace DeathNote.Releases;

/// <summary>Một cờ rủi ro hệ thống tự phát hiện trên hồ sơ mở vault.</summary>
public record RiskFlag(string Code, RiskSeverity Severity, string Message);
