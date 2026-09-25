using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace DeathNote;

/// <summary>
/// Đánh dấu mọi thuộc tính KHÔNG nullable là "required" trong OpenAPI, để client TypeScript sinh ra
/// kiểu chính xác (vd. `id: string` thay vì `id?: string | null`) — bắt lỗi ngay lúc biên dịch frontend.
/// </summary>
public class RequiredNonNullableSchemaFilter : ISchemaFilter
{
    public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema is not OpenApiSchema s || s.Properties == null || s.Properties.Count == 0) return;
        s.Required ??= new HashSet<string>();
        foreach (var (name, prop) in s.Properties)
        {
            var nullable = prop is OpenApiSchema p && p.Type.HasValue && p.Type.Value.HasFlag(JsonSchemaType.Null);
            var nullableUnion = prop is OpenApiSchema u && (u.OneOf?.Any(x => x is OpenApiSchema o && o.Type == JsonSchemaType.Null) ?? false);
            if (!nullable && !nullableUnion) s.Required.Add(name);
        }
    }
}
