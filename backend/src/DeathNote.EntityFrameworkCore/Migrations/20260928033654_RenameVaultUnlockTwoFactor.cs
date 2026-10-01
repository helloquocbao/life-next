using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DeathNote.Migrations
{
    /// <inheritdoc />
    public partial class RenameVaultUnlockTwoFactor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "CheckInTwoFactorEnabled",
                table: "DnOwnerProfiles",
                newName: "VaultUnlockTwoFactorEnabled");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "VaultUnlockTwoFactorEnabled",
                table: "DnOwnerProfiles",
                newName: "CheckInTwoFactorEnabled");
        }
    }
}
