using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DeathNote.Migrations
{
    /// <summary>
    /// Bỏ luồng mở vault thủ công (yêu cầu mở → đồng thuận → bằng chứng → 2 phiếu duyệt → chờ cuối) vì đã chuyển hẳn
    /// sang tự động bàn giao khi hết ân hạn:
    /// - Hồ sơ đang kẹt ở Verifying/Review/FinalWait (3/4/5) quay về Grace (2) để đi tiếp theo luồng tự động.
    /// - Xoá quyền "DeathNote.Releases.*" đã cấp và các mẫu email của luồng cũ đã tuỳ chỉnh.
    /// - Xoá các bảng yêu cầu mở, đồng thuận, bằng chứng, phiếu duyệt, giao mảnh khoá.
    /// </summary>
    public partial class RemoveManualReleaseQueue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"DnOwnerProfiles\" SET \"State\" = 2 WHERE \"State\" IN (3, 4, 5);");
            migrationBuilder.Sql("DELETE FROM \"AbpPermissionGrants\" WHERE \"Name\" LIKE 'DeathNote.Releases%';");
            migrationBuilder.Sql("DELETE FROM \"DnEmailTemplates\" WHERE \"Key\" IN ('owner-release-initiated', 'owner-final-warning', " +
                                 "'trustee-request-opened', 'trustee-rejected', 'trustee-needs-info');");

            migrationBuilder.DropTable(
                name: "DnReleaseConsents");

            migrationBuilder.DropTable(
                name: "DnReleaseEvidence");

            migrationBuilder.DropTable(
                name: "DnReviewVotes");

            migrationBuilder.DropTable(
                name: "DnShareDeliveries");

            migrationBuilder.DropTable(
                name: "DnReleaseRequests");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DnReleaseRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CloseNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeleterId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletionTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    FinalWaitUntil = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    InfoRequestNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    InitiatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    InitiatorTrusteeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    KeyVersion = table.Column<int>(type: "integer", nullable: false),
                    LastModificationTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reason = table.Column<int>(type: "integer", nullable: false),
                    ReleasedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    RequiredConsents = table.Column<int>(type: "integer", nullable: false),
                    ReviewRequestedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ReviewRound = table.Column<int>(type: "integer", nullable: false),
                    Statement = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DnReleaseRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DnReleaseConsents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsentedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ReleaseRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    Statement = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    TrusteeId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserAgent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DnReleaseConsents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DnReleaseConsents_DnReleaseRequests_ReleaseRequestId",
                        column: x => x.ReleaseRequestId,
                        principalTable: "DnReleaseRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DnReleaseEvidence",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BlobName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    FileName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    PurgedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ReleaseRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UploadedByTrusteeId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DnReleaseEvidence", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DnReleaseEvidence_DnReleaseRequests_ReleaseRequestId",
                        column: x => x.ReleaseRequestId,
                        principalTable: "DnReleaseRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DnReviewVotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdminName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    AdminUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Decision = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ReleaseRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    Round = table.Column<int>(type: "integer", nullable: false),
                    Stage = table.Column<int>(type: "integer", nullable: false),
                    VotedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DnReviewVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DnReviewVotes_DnReleaseRequests_ReleaseRequestId",
                        column: x => x.ReleaseRequestId,
                        principalTable: "DnReleaseRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DnShareDeliveries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FromTrusteeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReleaseRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    SealedShare = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    ToTrusteeId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DnShareDeliveries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DnShareDeliveries_DnReleaseRequests_ReleaseRequestId",
                        column: x => x.ReleaseRequestId,
                        principalTable: "DnReleaseRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DnReleaseConsents_ReleaseRequestId",
                table: "DnReleaseConsents",
                column: "ReleaseRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_DnReleaseEvidence_ReleaseRequestId",
                table: "DnReleaseEvidence",
                column: "ReleaseRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_DnReleaseRequests_OwnerId_Status",
                table: "DnReleaseRequests",
                columns: new[] { "OwnerId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_DnReleaseRequests_Status",
                table: "DnReleaseRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_DnReviewVotes_ReleaseRequestId",
                table: "DnReviewVotes",
                column: "ReleaseRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_DnShareDeliveries_ReleaseRequestId",
                table: "DnShareDeliveries",
                column: "ReleaseRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_DnShareDeliveries_ToTrusteeId",
                table: "DnShareDeliveries",
                column: "ToTrusteeId");
        }
    }
}
