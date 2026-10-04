# Death Note — Backend

API cho sản phẩm **Death Note**: bàn giao di sản số theo cơ chế "di sản cho người kế thừa" (legacy
for the successor), thiết kế **zero-knowledge** — server chỉ lưu trữ dữ liệu đã mã hoá, không bao
giờ có khả năng đọc nội dung két của người dùng.

> Tài liệu thiết kế nghiệp vụ gốc: xem file Word "Death Note — Ý tưởng Web & Mobile cho 3 vai trò"
> mà dự án này hiện thực hoá.

## 1. Kiến trúc

Một **ABP Framework 10.6 (open-source, LGPL-3.0)** modular monolith, layered theo DDD, phục vụ đồng
thời 2 ứng dụng khách hàng:

| Ứng dụng | Vai trò | Repo |
|---|---|---|
| App (Owner + Trustee) | Gộp chung 1 client (`DeathNote_App`) vì 1 tài khoản có thể vừa là owner (quản lý két, mời người nhận, phân bổ) vừa là trustee của người khác (đồng thuận, mở hộp nhận) | `frontend/apps/owner-web` |
| Admin Console | Đội vận hành PICO — thẩm định yêu cầu mở vault | `frontend/apps/admin-console` |

```
DeathNote.Domain.Shared        hằng số, enum, mã lỗi, tài nguyên đa ngôn ngữ (vi/en)
DeathNote.Domain               luật nghiệp vụ: state machine, mật mã (metadata), audit, worker
DeathNote.Application.Contracts DTO + interface application service (hợp đồng API)
DeathNote.Application          cài đặt use-case, kiểm tra quyền sở hữu dữ liệu
DeathNote.EntityFrameworkCore  DbContext, migration, ánh xạ PostgreSQL
DeathNote.HttpApi.Host         host duy nhất: REST API + máy chủ OpenIddict + Swagger
```

Backend **không** có tầng HttpApi/Client riêng (bỏ theo hướng tối giản MVP) — application service
được ABP tự động phơi thành REST tại `/api/app/*` (conventional/auto API controllers).

## 2. Nguyên tắc thiết kế cốt lõi

Toàn bộ code bám sát 5 nguyên tắc:

1. **Không heartbeat ≠ đã mất.** Hết heartbeat chỉ mở quy trình nhắc (`Missed → Grace`), chưa mở dữ liệu. Chỉ khi
   **hết thời gian ân hạn mà owner vẫn không check-in** hồ sơ mới tự động bàn giao. Xem
   [`OwnerProfile.cs`](src/DeathNote.Domain/Owners/OwnerProfile.cs) — không có đường tắt tới `Released`.
2. **Zero-knowledge.** Server chỉ lưu ciphertext (base64). Không có API nào trả về nội dung vault ở
   dạng rõ — kể cả cho admin. Xem cột `Ciphertext`/`Wrapped*`/`Sealed*` trong
   [`DeathNoteDbContext`](src/DeathNote.EntityFrameworkCore/EntityFrameworkCore/DeathNoteDbContext.cs).
3. **Hai vai trò, đúng trình tự.** *Người nhắc nhở* được báo trước để nhắc owner bấm "Tôi vẫn ổn" (không nhận
   thông tin nào); *người nhận thông tin* tự động nhận phần owner cho phép khi hết ân hạn (không được báo gì trước đó).
   Xem [`TrusteeRole.cs`](src/DeathNote.Domain.Shared/Trustees/TrusteeRole.cs).
4. **Owner luôn có quyền phủ quyết.** Check-in ở bất kỳ giai đoạn nào trước `Released` huỷ ngay toàn
   bộ tiến trình. Xem `LifecycleManager.CheckInAsync`.
5. **Audit log bất biến.** Chuỗi băm SHA-256 nối tiếp + trigger PostgreSQL chặn UPDATE/DELETE. Xem
   [`AuditTrailManager.cs`](src/DeathNote.Domain/AuditTrail/AuditTrailManager.cs) và migration
   `AuditEventsAppendOnly`.

> Cơ chế m-of-n (Shamir) + thẩm định 2 phiếu của PICO đã được **thay bằng bàn giao tự động theo thời gian**
> (migration `SimplifyRolesAndAutoRelease`). Các lớp `ReleaseRequest`/`ReleaseManager`/Admin review vẫn còn trong
> mã nhưng không còn được kích hoạt từ ứng dụng.

## 3. Vòng đời hồ sơ (state machine)

```
Active ──quá hạn──▶ Missed ──hết các vòng nhắc owner──▶ Grace ──hết ân hạn──▶ Released (tự động)
  ▲                  (nhắc OWNER 4 vòng)               (báo NGƯỜI NHẮC NHỞ)    (người nhận mở hộp nhận)
  └─────────────── owner check-in / huỷ (mọi giai đoạn trước Released) ◀────────┘
```

| Giai đoạn | Ai được báo | Việc xảy ra |
|---|---|---|
| `Missed` | Chỉ owner (push → email → sms → gọi) | Tự mời người nhắc nhở chưa được mời |
| `Grace` | **Người nhắc nhở** | "Hãy liên lạc, nhắc owner bấm Tôi vẫn ổn", kèm số ngày còn lại |
| `Released` | **Người nhận thông tin** (chỉ ai thật sự có phần) | Server mới trao `Grant` đã niêm phong cho đúng từng người |

Tham số vòng đời cấu hình tại `DeathNote:Policy` trong `appsettings.json`
([`LifecyclePolicyOptions`](src/DeathNote.Domain/Lifecycle/LifecyclePolicyOptions.cs)):

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `MissedPhaseDays` | 7 | Thời gian leo thang nhắc **owner** (push→email→sms→call) |
| `DefaultGraceDays` / `Min` / `Max` | 14 / 7 / 30 | Số ngày người nhắc nhở có để liên lạc trước khi tự động bàn giao (owner chọn) |
| `TimeScale` | 1 | Hệ số nén thời gian cho **demo** — `2880` = 1 ngày ≈ 30 giây |

`LifecycleWorker` ([nền, chạy mỗi `WorkerPeriodSeconds` giây](src/DeathNote.Domain/Lifecycle/LifecycleWorker.cs))
quét hồ sơ quá hạn, gửi nhắc, chuyển `Missed → Grace`, và chuyển `Grace → Released` khi hết ân hạn.
(Các tham số `FinalWaitHours`, `ReviewSlaDays`, `EnforceDistinctConsentIp` thuộc quy trình thẩm định cũ, không còn tác dụng.)

## 4. Mật mã — những gì server KHÔNG BAO GIỜ thấy

Mọi mã hoá/giải mã chạy trên trình duyệt (xem `frontend/packages/crypto`). Backend chỉ vận chuyển và
lưu trữ ciphertext:

- Nội dung hạng mục — kể cả **tiêu đề** và **loại** ([`VaultItem.cs`](src/DeathNote.Domain/Vaults/VaultItem.cs)).
- Ai được phân hạng mục nào — server chỉ thấy "người nhận X có N hạng mục" ([`Grant.cs`](src/DeathNote.Domain/Vaults/Grant.cs)).
- Khoá riêng của bất kỳ ai, ở bất kỳ dạng nào.
- Nội dung thư/video để lại.

Với **mỗi người nhận**, owner đóng gói (thư + danh sách hạng mục kèm khoá từng hạng mục) rồi **niêm phong**
(`crypto_box_seal`, X25519) bằng khoá công khai của đúng người đó — ngay trên trình duyệt owner. Server giữ bản niêm
phong và chỉ trao khi hồ sơ `Released`. Người nhận mở bằng khoá riêng nằm trên thiết bị của họ, bọc bằng passphrase của
chính họ; kể cả khi toàn bộ hạ tầng bị chiếm quyền, kẻ tấn công vẫn cần khoá riêng của người nhận.
**Hệ quả:** người nhận thông tin phải được mời sớm và tạo khoá cá nhân TRƯỚC — chưa có khoá thì phần dành cho họ
không thể được niêm phong và họ sẽ không nhận được gì. Người nhắc nhở không cần khoá.

## 5. Tech stack

| Hạng mục | Lựa chọn |
|---|---|
| Runtime | .NET 10 |
| Framework | ABP Framework 10.6 (open-source) |
| Auth | OpenIddict — Authorization Code + PKCE, 2 client (App gộp Owner+Trustee / Admin) + Swagger |
| Database | PostgreSQL 17 + EF Core 10 (Npgsql) |
| Background job | ABP Background Worker (`LifecycleWorker`) — không dùng Hangfire ở MVP |
| Lưu file | ABP BlobStoring, filesystem cục bộ (`App_Data/blobs`) — production nên chuyển sang S3/MinIO |
| Email | SMTP qua ABP Emailing (dev: Mailpit tại `localhost:8026`) |
| SMS/Push/Call | **Stub** — chỉ ghi log, chưa tích hợp nhà cung cấp thật |
| Test | xUnit + Shouldly, `AbpIntegratedTest` cho test tích hợp trên PostgreSQL thật |

## 6. Cấu trúc API (`/api/app/*`)

| Application service | Dành cho | Việc chính |
|---|---|---|
| `IOwnerAppService` | Owner | Trạng thái, check-in, cấu hình nhịp, tạm dừng, 2FA, diễn tập, nhật ký |
| `IVaultAppService` | Owner | Két dữ liệu (CRUD hạng mục), phân mảnh khoá + phân bổ |
| `ITrusteeAppService` | Owner | Quản lý danh sách người được uỷ quyền |
| `ITrusteePortalAppService` | Trustee | Lời mời, khoá cá nhân, đồng thuận, bằng chứng, hộp nhận |
| `IAdminDashboardAppService` | Admin | Dashboard, quyền, chính sách |
| `IReleaseReviewAppService` | Admin | Hàng chờ, chi tiết hồ sơ (5 khối), bỏ phiếu 4 mắt |
| `IAdminAuditAppService` | Admin | Audit log toàn hệ thống, kiểm tra chuỗi băm |

Toàn bộ hợp đồng nằm ở `DeathNote.Application.Contracts` — Swagger/OpenAPI được sinh trực tiếp từ
đây tại `http://localhost:5080/swagger`, và frontend sinh TypeScript client tự động từ đó
(`pnpm gen:api`).

## 7. Chạy cục bộ

### Yêu cầu
- .NET SDK 10
- Docker (Postgres + Mailpit)
- ABP CLI: `dotnet tool install -g Volo.Abp.Cli`

### Khởi động hạ tầng
```bash
docker compose -f ../deploy/docker-compose.yml up -d   # Postgres :55433, Mailpit :8026/:1026
```

### Cài thư viện giao diện trang đăng nhập (một lần, sau khi clone)
`wwwroot/libs` (jQuery, Bootstrap...) không nằm trong git — cài lại bằng ABP CLI:
```bash
cd src/DeathNote.HttpApi.Host && abp install-libs
```

### Chạy API
```bash
cd src/DeathNote.HttpApi.Host
ASPNETCORE_ENVIRONMENT=Development dotnet run --urls http://localhost:5080
```
Ở môi trường Development, backend **tự động migrate + seed dữ liệu demo** khi khởi động
(`App:MigrateOnStartup=true`, `DeathNote:SeedDemoUsers=true` trong `appsettings.Development.json`).

### Tài khoản demo (seed tự động, mật khẩu `Demo@123`)
| Username | Vai trò |
|---|---|
| `owner` | Owner |
| `trustee1`, `trustee2`, `trustee3` | Trustee |
| `reviewer` | Admin — thẩm định (phiếu 1) |
| `approver` | Admin — phê duyệt (phiếu 2) |
| `support` | Admin — hỗ trợ (không xem bằng chứng) |
| `compliance` | Admin — tuân thủ |
| `admin` / `1q2w3E*` | Super admin (theo thiết kế, **không** có quyền duyệt mở vault) |

### Đăng nhập SSO bằng Google (chỉ owner)

Luồng REST, không redirect: owner-web lấy ID token qua Google Identity Services → `POST /connect/token`
với `grant_type=google&id_token=…` (`Authentication/GoogleTokenExtensionGrant.cs`). Backend kiểm chữ ký +
audience với Google, rồi dùng tài khoản đã liên kết `sub` → hoặc liên kết vào tài khoản cùng email → hoặc tạo
tài khoản mới (username = email). Grant chỉ cấp cho client `DeathNote_App`; tài khoản nội bộ (có role) bị từ chối.

1. Google Cloud Console → *APIs & Services → Credentials → OAuth client ID* (loại **Web application**),
   *Authorized JavaScript origins*: `http://localhost:5173` (+ domain production). Không cần redirect URI.
2. Backend: `Authentication:Google:ClientId` (user-secrets hoặc biến môi trường `Authentication__Google__ClientId`).
3. Frontend: `VITE_GOOGLE_CLIENT_ID` trong `frontend/apps/owner-web/.env` (cùng giá trị).
4. Chạy lại seed (dev: tự chạy khi khởi động) để client `DeathNote_App` có quyền `gt:google`.

### Chạy test
```bash
dotnet test                                      # toàn bộ (Domain + Application)
dotnet test test/DeathNote.Domain.Tests          # unit test state machine, bàn giao tự động, audit chain
dotnet test test/DeathNote.Application.Tests     # integration test trọn vòng đời trên Postgres thật
```
`FullLifecycleTests.Full_lifecycle_from_onboarding_to_automatic_release` mô phỏng toàn bộ hành trình: owner
onboarding → thêm 2 người nhắc nhở + 1 người nhận → người nhận tạo khoá, owner niêm phong phần dành cho họ → im lặng →
nhắc owner 4 vòng → Grace (chỉ người nhắc nhở được báo, người nhận không biết gì) → hết ân hạn → tự động bàn giao →
người nhận mở đúng phần của mình → xác minh audit log toàn vẹn + bất biến. Kèm kịch bản owner check-in giữa ân hạn
thì huỷ toàn bộ và không ai nhận gì.

### Reset database về trạng thái sạch
```bash
docker exec deathnote-postgres-1 psql -U postgres \
  -c 'DROP DATABASE IF EXISTS "DeathNote";' -c 'CREATE DATABASE "DeathNote";'
# rồi khởi động lại API — nó tự migrate + seed lại
```

## 8. Ghi chú vận hành

- **Chứng chỉ ký token (OpenIddict):** ở Development dùng khoá *ephemeral* (sinh trong RAM mỗi lần
  chạy) — cố tình tránh chứng chỉ lưu trong macOS Keychain (gây lỗi `CSSMERR_CSP_USER_CANCELED`).
  Hệ quả: restart backend làm mất hiệu lực token cũ, cần đăng nhập lại — chấp nhận được lúc dev.
  Production dùng `openiddict.pfx` thật, cấu hình `AuthServer:CertificatePassPhrase`.
- **`DeathNote:CheckInLinkSecret`**: bắt buộc đổi trước khi lên production (dùng ký HMAC link
  check-in một chạm qua email/SMS).
- **CORS**: chỉ mở đúng 3 origin của 3 app trong `App:CorsOrigins`.
- **Migration mới**: `dotnet ef migrations add <Tên> -o Migrations -p src/DeathNote.EntityFrameworkCore -s src/DeathNote.HttpApi.Host`.

## 9. Việc còn để ngỏ trước khi lên production

- Tích hợp nhà cung cấp SMS/Push/gọi tự động thật (hiện là stub ghi log).
- Chuyển lưu trữ bằng chứng từ filesystem sang S3/MinIO.
- Tách Auth Server thành tiến trình riêng nếu cần scale ngang (hiện gộp chung host).
- Bật HTTPS + chứng chỉ ký token thật, đổi mọi secret mặc định, tắt tài khoản demo.
