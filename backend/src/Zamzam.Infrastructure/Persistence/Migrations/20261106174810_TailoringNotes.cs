using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zamzam.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TailoringNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: "zamzam",
                table: "TailoringSpecs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Notes",
                schema: "zamzam",
                table: "TailoringSpecs");
        }
    }
}
