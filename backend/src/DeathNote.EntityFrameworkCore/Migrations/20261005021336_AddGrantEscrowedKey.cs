using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DeathNote.Migrations
{
    /// <inheritdoc />
    public partial class AddGrantEscrowedKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EscrowedKey",
                table: "DnGrants",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EscrowedKey",
                table: "DnGrants");
        }
    }
}
