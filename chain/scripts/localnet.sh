#!/usr/bin/env bash
# Validator Solana local đã nạp sẵn chương trình LifeNext bản demo-time (1 ngày = 4 giây).
# Build trước: anchor build --arch v1 -- --features demo-time && cp target/deploy/lifenext.so target/demo/
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
PROGRAM_ID=$(solana-keygen pubkey keys/program-dev.json)
exec solana-test-validator --reset --quiet --ledger .localnet-ledger \
  --bpf-program "$PROGRAM_ID" target/demo/lifenext.so
