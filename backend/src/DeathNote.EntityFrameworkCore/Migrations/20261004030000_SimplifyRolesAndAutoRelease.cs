using DeathNote.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DeathNote.Migrations
{
    /// <summary>
    /// Chuyển sang luồng bàn giao TỰ ĐỘNG theo thời gian (không còn m-of-n / thẩm định):
    /// - Vai trò 0 (KeyHolder — người giữ mảnh khoá) bị bỏ → đổi thành 1 (Recipient — người nhận thông tin).
    /// - Mảnh khoá (KeyShares) và Grant cũ (khoá hai lớp bằng ReleaseKey) không còn mở được theo cơ chế mới →
    ///   xoá, và đánh dấu vault "cần lưu lại lựa chọn" để owner phân bổ lại (Grant mới niêm phong thẳng cho người nhận).
    /// Không đổi cấu trúc bảng nên model snapshot giữ nguyên.
    /// </summary>
    [DbContext(typeof(DeathNoteDbContext))]
    [Migration("20261004030000_SimplifyRolesAndAutoRelease")]
    public partial class SimplifyRolesAndAutoRelease : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"DnTrustees\" SET \"Role\" = 1 WHERE \"Role\" = 0;");
            migrationBuilder.Sql("DELETE FROM \"DnKeyShares\";");
            migrationBuilder.Sql("DELETE FROM \"DnGrants\";");
            migrationBuilder.Sql("UPDATE \"DnVaults\" SET \"KeysOutdated\" = TRUE WHERE \"KeysDistributedAt\" IS NOT NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Không thể khôi phục: mảnh khoá/Grant cũ đã bị xoá và vai trò KeyHolder không còn tồn tại.
        }
    }
}
