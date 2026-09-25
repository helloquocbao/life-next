using DeathNote.Infrastructure;

namespace DeathNote;

/// <summary>Lấy IP và User-Agent của request hiện tại (tôn trọng X-Forwarded-For khi chạy sau reverse proxy).</summary>
public class HttpRequestContext : IRequestContext
{
    private readonly IHttpContextAccessor _accessor;

    public HttpRequestContext(IHttpContextAccessor accessor) => _accessor = accessor;

    public string? IpAddress
    {
        get
        {
            var ctx = _accessor.HttpContext;
            if (ctx == null) return null;
            var forwarded = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            return !string.IsNullOrWhiteSpace(forwarded)
                ? forwarded.Split(',')[0].Trim()
                : ctx.Connection.RemoteIpAddress?.ToString();
        }
    }

    public string? UserAgent => _accessor.HttpContext?.Request.Headers.UserAgent.ToString();
}
