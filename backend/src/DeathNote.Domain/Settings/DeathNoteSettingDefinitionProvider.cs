using Volo.Abp.Settings;

namespace DeathNote.Settings;

public static class DeathNoteSettings
{
    /// <summary>Chính sách vòng đời admin đã chỉnh (JSON của <see cref="Lifecycle.EditablePolicy"/>).</summary>
    public const string Policy = "DeathNote.Policy";

    /// <summary>"true" khi đã seed vai trò mặc định — để vai trò admin xoá/đổi tên không bị tạo lại.</summary>
    public const string DefaultRolesSeeded = "DeathNote.DefaultRolesSeeded";
}

public class DeathNoteSettingDefinitionProvider : SettingDefinitionProvider
{
    public override void Define(ISettingDefinitionContext context)
    {
        // Không cho client đọc: chỉ đi qua API admin có kiểm quyền.
        context.Add(new SettingDefinition(DeathNoteSettings.Policy, isVisibleToClients: false));
        context.Add(new SettingDefinition(DeathNoteSettings.DefaultRolesSeeded, isVisibleToClients: false));
    }
}
