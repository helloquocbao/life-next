using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DeathNote.Migrations
{
    /// <summary>
    /// Tách quyền gộp thành quyền theo từng hành động: ai đang có "DeathNote.Staff.Manage" nhận đủ Thêm / Sửa / Khoá /
    /// Đặt lại mật khẩu; ai có "DeathNote.Roles.Manage" nhận đủ Tạo / Sửa / Xoá — rồi xoá quyền gộp cũ.
    /// Quyền mới "Xem email & SĐT khách hàng" KHÔNG cấp cho ai (mặc định che) — admin tự chọn ở màn hình Vai trò.
    /// </summary>
    public partial class SplitAdminPermissions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO "AbpPermissionGrants" ("Id", "TenantId", "Name", "ProviderName", "ProviderKey")
                SELECT gen_random_uuid(), g."TenantId", m.new_name, g."ProviderName", g."ProviderKey"
                FROM "AbpPermissionGrants" g
                JOIN (VALUES
                    ('DeathNote.Staff.Manage', 'DeathNote.Staff.Create'),
                    ('DeathNote.Staff.Manage', 'DeathNote.Staff.Update'),
                    ('DeathNote.Staff.Manage', 'DeathNote.Staff.Lock'),
                    ('DeathNote.Staff.Manage', 'DeathNote.Staff.ResetPassword'),
                    ('DeathNote.Roles.Manage', 'DeathNote.Roles.Create'),
                    ('DeathNote.Roles.Manage', 'DeathNote.Roles.Update'),
                    ('DeathNote.Roles.Manage', 'DeathNote.Roles.Delete')
                ) AS m(old_name, new_name) ON g."Name" = m.old_name
                WHERE NOT EXISTS (SELECT 1 FROM "AbpPermissionGrants" x
                                  WHERE x."Name" = m.new_name AND x."ProviderName" = g."ProviderName" AND x."ProviderKey" = g."ProviderKey");
                DELETE FROM "AbpPermissionGrants" WHERE "Name" IN ('DeathNote.Staff.Manage', 'DeathNote.Roles.Manage');
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
