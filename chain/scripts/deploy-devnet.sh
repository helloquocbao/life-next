#!/usr/bin/env bash
# Deploy chương trình LifeNext bản demo-time (1 ngày = 4 giây) lên devnet để trình diễn.
# Cần ví deploy keys/deployer-dev.json có ≥ 2 SOL devnet (https://faucet.solana.com).
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
DEPLOYER=keys/deployer-dev.json
PROGRAM=keys/program-dev.json
echo "Ví deploy: $(solana-keygen pubkey $DEPLOYER) — số dư: $(solana balance -u devnet -k $DEPLOYER)"
anchor build --arch v1 -- --features demo-time
solana program deploy target/deploy/lifenext.so --program-id "$PROGRAM" -u devnet -k "$DEPLOYER"
echo "Program ID: $(solana-keygen pubkey $PROGRAM)"
