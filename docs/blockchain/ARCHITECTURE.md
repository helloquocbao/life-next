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
| Khoá cho B | Lit Protocol mã hoá khoá két với điều kiện: két đã `claimed` **và** người xin là ví B. |
| Dữ liệu két | Mã hoá XChaCha20-Poly1305 tại trình duyệt; lưu nơi xoá được (IPFS + pin). Trên chuỗi chỉ có `uri` + SHA-256. |
| Web | `frontend/apps/chain-web`: kết nối Phantom, A quản lý két + thanh toán, B nhận két. |

## Ngoài phạm vi MVP (làm sau)
Đăng nhập bằng email (ví nhúng), B nhận bằng email thay vì ví, thanh toán thẻ (Stripe), trả phí giao dịch thay,
dịch vụ email nhắc, thanh toán bằng USDC.
