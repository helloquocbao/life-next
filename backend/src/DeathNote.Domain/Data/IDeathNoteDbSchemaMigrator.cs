namespace DeathNote.Data;

/// <summary>Áp dụng migration CSDL (cài đặt ở tầng EntityFrameworkCore).</summary>
public interface IDeathNoteDbSchemaMigrator
{
    Task MigrateAsync();
}
