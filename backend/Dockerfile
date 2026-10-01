# =============================================================================
# LifeNext API (DeathNote.HttpApi.Host) — image production
# Build context: thư mục backend/   →   docker build -t lifenext-api backend
#
# Lưu ý: wwwroot/libs (thư viện JS/CSS cho trang đăng nhập) bị .gitignore — phải có sẵn
# trong build context (chạy `abp install-libs` ở máy dev, deploy.sh sẽ rsync kèm lên server).
# =============================================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore trước (tách layer để cache NuGet khi chỉ đổi code).
COPY NuGet.Config common.props ./
COPY src/DeathNote.Domain.Shared/DeathNote.Domain.Shared.csproj src/DeathNote.Domain.Shared/
COPY src/DeathNote.Domain/DeathNote.Domain.csproj src/DeathNote.Domain/
COPY src/DeathNote.Application.Contracts/DeathNote.Application.Contracts.csproj src/DeathNote.Application.Contracts/
COPY src/DeathNote.Application/DeathNote.Application.csproj src/DeathNote.Application/
COPY src/DeathNote.EntityFrameworkCore/DeathNote.EntityFrameworkCore.csproj src/DeathNote.EntityFrameworkCore/
COPY src/DeathNote.HttpApi.Host/DeathNote.HttpApi.Host.csproj src/DeathNote.HttpApi.Host/
RUN dotnet restore src/DeathNote.HttpApi.Host/DeathNote.HttpApi.Host.csproj

COPY src/ src/
RUN test -d src/DeathNote.HttpApi.Host/wwwroot/libs/abp \
    || (echo "Thiếu wwwroot/libs — chạy 'abp install-libs' trong src/DeathNote.HttpApi.Host trước khi build" && exit 1)
RUN dotnet publish src/DeathNote.HttpApi.Host/DeathNote.HttpApi.Host.csproj \
    -c Release -o /app --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
# libgssapi-krb5-2: Npgsql nạp thư viện này khi kết nối (thiếu thì log lỗi mỗi lần khởi động).
RUN apt-get update && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app .
# Thư mục ghi được cho user không-root: tệp bằng chứng (blob), log, khoá DataProtection (cookie đăng nhập).
RUN mkdir -p App_Data/blobs Logs /home/app/.aspnet/DataProtection-Keys \
    && chown -R app:app App_Data Logs /home/app/.aspnet
USER app
# Image aspnet đã mặc định lắng nghe :8080 (ASPNETCORE_HTTP_PORTS).
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "DeathNote.HttpApi.Host.dll"]
