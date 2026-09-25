using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DeathNote.Migrations
{
    /// <summary>
    /// Biến bảng DnAuditEvents thành APPEND-ONLY ở cấp CSDL: mọi lệnh UPDATE / DELETE / TRUNCATE
    /// đều bị trigger chặn — kể cả khi ứng dụng bị chiếm quyền hoặc có người sửa tay bằng SQL
    /// (trừ superuser cố tình gỡ trigger, và hành vi đó sẽ làm gãy chuỗi băm).
    /// </summary>
    public partial class AuditEventsAppendOnly : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION dn_audit_events_block_mutation() RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'DnAuditEvents là bảng append-only: không được % dữ liệu', TG_OP;
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER dn_audit_events_no_update_delete
                    BEFORE UPDATE OR DELETE ON "DnAuditEvents"
                    FOR EACH ROW EXECUTE FUNCTION dn_audit_events_block_mutation();

                CREATE TRIGGER dn_audit_events_no_truncate
                    BEFORE TRUNCATE ON "DnAuditEvents"
                    FOR EACH STATEMENT EXECUTE FUNCTION dn_audit_events_block_mutation();
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS dn_audit_events_no_truncate ON "DnAuditEvents";
                DROP TRIGGER IF EXISTS dn_audit_events_no_update_delete ON "DnAuditEvents";
                DROP FUNCTION IF EXISTS dn_audit_events_block_mutation();
                """);
        }
    }
}
