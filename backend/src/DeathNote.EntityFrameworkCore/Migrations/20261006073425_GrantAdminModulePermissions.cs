using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DeathNote.Migrations
{
    /// <summary>
    /// Từ nay seed chỉ cấp quyền khi vai trò được tạo lần đầu (quyền là dữ liệu admin chỉnh ở màn hình "Vai trò").
    /// CSDL đã có sẵn các vai trò mặc định → cấp một lần các quyền của module mới (Khách hàng, Nhân viên, Vai trò)
    /// đúng như bảng phân quyền mặc định. Bỏ qua vai trò không tồn tại và quyền đã có. Không đổi cấu trúc bảng.
    /// </summary>
    public partial class GrantAdminModulePermissions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO "AbpPermissionGrants" ("Id", "TenantId", "Name", "ProviderName", "ProviderKey")
                SELECT gen_random_uuid(), NULL, v.perm, 'R', v.role
                FROM (VALUES
                    ('support',    'DeathNote.Customers'),
                    ('reviewer',   'DeathNote.Customers'),
                    ('approver',   'DeathNote.Customers'),
                    ('compliance', 'DeathNote.Customers'),
                    ('compliance', 'DeathNote.Staff'),
                    ('compliance', 'DeathNote.Roles')
                ) AS v(role, perm)
                WHERE EXISTS (SELECT 1 FROM "AbpRoles" r WHERE r."Name" = v.role)
                  AND NOT EXISTS (SELECT 1 FROM "AbpPermissionGrants" g
                                  WHERE g."Name" = v.perm AND g."ProviderName" = 'R' AND g."ProviderKey" = v.role);
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Không thu hồi: sau migration, quyền vai trò là dữ liệu admin tự chỉnh.
        }
    }
}
