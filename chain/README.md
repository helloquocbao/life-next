# LifeNext on Solana — chương trình on-chain

Luật bàn giao (không quản trị, không nâng cấp): xem chú thích đầu `programs/lifenext/src/lib.rs`.

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
anchor build --arch v1   # SBPF v1: chạy được trên devnet/mainnet và LiteSVM
cargo test               # kiểm thử luật trên LiteSVM (tua thời gian)
```

- `TREASURY` trong `constants.rs` là ví nhận phí của bên vận hành — đổi trước khi phát hành mainnet.
- `keys/` (bị gitignore) chứa keypair dev; không commit khoá riêng.
