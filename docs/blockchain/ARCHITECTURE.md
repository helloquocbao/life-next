# LifeNext trên Solana — thiết kế MVP (nhánh `blockchain`)

**A** = người dùng (chủ két). **B** = người nhận bàn giao. Không server giữ dữ liệu/khoá, không quản trị.

## Luật đã chốt
- A tạo nhiều **két**, mỗi két giao cho **đúng một B**. Két chứa thông tin dạng chữ + tệp tài liệu.
- **Thanh toán theo tháng = check-in.** A tự bấm trả (không tự gia hạn). Trả trước tối đa 90 ngày (biết trước sẽ vắng).
- A **quá hạn thanh toán 30 ngày** → bàn giao. B trả phần A còn nợ (1 tháng, thu một lần cho mỗi đợt A ngừng trả) rồi mới mở.
- A trả lại trước khi B lấy → huỷ bàn giao (két chưa lấy). B lấy rồi → không đảo ngược.
- A muốn bỏ dịch vụ phải **tự xoá két** (ngừng trả = sẽ bàn giao). Xoá → hoàn cọc rent cho bên đã đặt cọc.
- **Mất ví = mất két.** Không có quản trị, không khôi phục. Chương trình không có hàm admin, không nâng cấp.
- Hệ thống thu thuê bao và trả mọi phí khác (rent, phí giao dịch, lưu trữ, Lit) — A, B chỉ trả thuê bao.

## Thành phần
| Thành phần | Cách làm |
|---|---|
| Chương trình Solana (`chain/`) | Anchor. `Profile` (paid_until) + `Vault` (heir, uri, hash, claimed). Lệnh: `init_profile`, `pay`, `create/update/delete_vault`, `claim`, `close_profile`. |
| Khoá két của A | Ký một thông điệp gắn tên miền bằng ví → HKDF → khoá riêng mỗi két. Không lưu ở đâu. |
| Khoá cho B | **Nút mở khoá theo ngưỡng** (`frontend/apps/release-node`): khoá két chia Shamir 2-trong-3, mỗi mảnh niêm phong cho một nút độc lập. Nút chỉ trả mảnh khi két đã `claimed` trên chuỗi **và** người xin ký đúng bằng ví B. Nút không lưu dữ liệu, chỉ giữ một khoá riêng; dưới 2 nút thông đồng thì không mở được gì. |
| Dữ liệu két | Mã hoá XChaCha20-Poly1305 tại trình duyệt; lưu nơi xoá được (IPFS + pin). Trên chuỗi chỉ có `uri` + SHA-256. |
| Web | `frontend/apps/chain-web`: web tĩnh, kết nối ví Solana, A quản lý két + thanh toán, B nhận + mở két. |

## Vì sao không dùng Lit Protocol
Kiểm tra ngày 18/10/2026: mạng Lit v7 (Datil) đã ngừng; SDK v8 (Naga) không còn đăng nhập bằng ví Solana và RPC
`yellowstone-rpc.litprotocol.com` không còn tồn tại (NXDOMAIN). Nút mở khoá theo ngưỡng thay thế, cùng nguyên tắc:
không một bên nào giữ đủ khoá. Khi phát hành thật, 3 nút phải do 3 bên khác nhau vận hành.

## Chạy thử trên máy (localnet)
```bash
docker compose -f chain/docker-compose.yml up -d                 # IPFS dev
bash chain/scripts/localnet.sh                                    # validator + chương trình bản demo-time
pnpm --dir frontend/apps/release-node dev                         # 3 nút mở khoá :7101-7103
cp frontend/apps/chain-web/.env.example frontend/apps/chain-web/.env.local   # điền khoá công khai từ GET :710x/info
pnpm --dir frontend/apps/chain-web dev                            # http://localhost:5190 — mở 2 tab: A và B
```
Kiểm thử: `cargo test` trong `chain/` (luật on-chain), `pnpm --filter @deathnote/chain test`,
`pnpm --filter @deathnote/release-node test`, và trọn luồng `LOCALNET=1 pnpm --filter @deathnote/chain test`.

## Ngoài phạm vi MVP (làm sau)
Deploy devnet/mainnet + 3 nút do 3 bên vận hành, audit chương trình, đăng nhập bằng email (ví nhúng), B nhận bằng email thay vì ví, thanh toán thẻ (Stripe), trả phí giao dịch thay,
dịch vụ email nhắc, thanh toán bằng USDC.
