//! Kiểm thử các luật của LifeNext trên LiteSVM (tua thời gian bằng sysvar Clock).
use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    lifenext::{state::{Profile, Vault}, MONTHLY_PRICE_LAMPORTS, MONTH_SECONDS, PROFILE_SEED, TREASURY, VAULT_SEED},
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const DAY: i64 = 24 * 60 * 60;

struct Env {
    svm: LiteSVM,
    a: Keypair,
}

impl Env {
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/lifenext.so"));
        svm.add_program(lifenext::id(), bytes).unwrap();
        let mut clock: Clock = svm.get_sysvar();
        clock.unix_timestamp = 1_800_000_000;
        svm.set_sysvar(&clock);
        let a = Keypair::new();
        svm.airdrop(&a.pubkey(), 10_000_000_000).unwrap();
        Env { svm, a }
    }

    fn funded(&mut self) -> Keypair {
        let k = Keypair::new();
        self.svm.airdrop(&k.pubkey(), 10_000_000_000).unwrap();
        k
    }

    fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    fn advance(&mut self, secs: i64) {
        let mut clock: Clock = self.svm.get_sysvar();
        clock.unix_timestamp += secs;
        clock.slot += 1;
        self.svm.set_sysvar(&clock);
    }

    fn send(&mut self, ix: Instruction, signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let blockhash = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(&[ix], Some(&signers[0].pubkey()), &blockhash);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
        self.svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e.meta.logs))
    }

    fn profile_pda(owner: &Pubkey) -> Pubkey {
        Pubkey::find_program_address(&[PROFILE_SEED, owner.as_ref()], &lifenext::id()).0
    }

    fn vault_pda(owner: &Pubkey, id: u32) -> Pubkey {
        Pubkey::find_program_address(&[VAULT_SEED, owner.as_ref(), &id.to_le_bytes()], &lifenext::id()).0
    }

    fn profile(&self) -> Profile {
        let acc = self.svm.get_account(&Self::profile_pda(&self.a.pubkey())).unwrap();
        Profile::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    fn vault(&self, id: u32) -> Vault {
        let acc = self.svm.get_account(&Self::vault_pda(&self.a.pubkey(), id)).unwrap();
        Vault::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    fn balance(&self, k: &Pubkey) -> u64 {
        self.svm.get_balance(k).unwrap_or(0)
    }

    fn init_profile(&mut self) {
        let a = self.a.insecure_clone();
        let ix = Instruction::new_with_bytes(
            lifenext::id(),
            &lifenext::instruction::InitProfile {}.data(),
            lifenext::accounts::InitProfile {
                payer: a.pubkey(),
                owner: a.pubkey(),
                profile: Self::profile_pda(&a.pubkey()),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, &[&a]).unwrap();
    }

    fn pay_with_treasury(&mut self, months: u16, treasury: Pubkey) -> Result<(), String> {
        let a = self.a.insecure_clone();
        let ix = Instruction::new_with_bytes(
            lifenext::id(),
            &lifenext::instruction::Pay { months }.data(),
            lifenext::accounts::Pay {
                payer: a.pubkey(),
                owner: a.pubkey(),
                profile: Self::profile_pda(&a.pubkey()),
                treasury,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, &[&a])
    }

    fn pay(&mut self, months: u16) -> Result<(), String> {
        self.pay_with_treasury(months, TREASURY)
    }

    fn create_vault(&mut self, heir: Pubkey) -> u32 {
        let a = self.a.insecure_clone();
        let id = self.profile().next_vault_id;
        let ix = Instruction::new_with_bytes(
            lifenext::id(),
            &lifenext::instruction::CreateVault { heir, uri: "ipfs://bafy-test".into(), content_hash: [7; 32] }.data(),
            lifenext::accounts::CreateVault {
                payer: a.pubkey(),
                owner: a.pubkey(),
                profile: Self::profile_pda(&a.pubkey()),
                vault: Self::vault_pda(&a.pubkey(), id),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, &[&a]).unwrap();
        id
    }

    fn update_vault(&mut self, id: u32, heir: Pubkey) -> Result<(), String> {
        let a = self.a.insecure_clone();
        let ix = Instruction::new_with_bytes(
            lifenext::id(),
            &lifenext::instruction::UpdateVault { heir, uri: "ipfs://bafy-v2".into(), content_hash: [8; 32] }.data(),
            lifenext::accounts::UpdateVault { owner: a.pubkey(), vault: Self::vault_pda(&a.pubkey(), id) }
                .to_account_metas(None),
        );
        self.send(ix, &[&a])
    }

    fn delete_vault(&mut self, id: u32) -> Result<(), String> {
        let a = self.a.insecure_clone();
        let ix = Instruction::new_with_bytes(
            lifenext::id(),
            &lifenext::instruction::DeleteVault {}.data(),
            lifenext::accounts::DeleteVault {
                owner: a.pubkey(),
                profile: Self::profile_pda(&a.pubkey()),
                vault: Self::vault_pda(&a.pubkey(), id),
                rent_payer: a.pubkey(),
            }
            .to_account_metas(None),
        );
        self.send(ix, &[&a])
    }

    fn close_profile(&mut self) -> Result<(), String> {
        let a = self.a.insecure_clone();
        let ix = Instruction::new_with_bytes(
            lifenext::id(),
            &lifenext::instruction::CloseProfile {}.data(),
            lifenext::accounts::CloseProfile {
                owner: a.pubkey(),
                profile: Self::profile_pda(&a.pubkey()),
                rent_payer: a.pubkey(),
            }
            .to_account_metas(None),
        );
        self.send(ix, &[&a])
    }

    fn claim(&mut self, heir: &Keypair, id: u32) -> Result<(), String> {
        let owner = self.a.pubkey();
        let ix = Instruction::new_with_bytes(
            lifenext::id(),
            &lifenext::instruction::Claim {}.data(),
            lifenext::accounts::Claim {
                heir: heir.pubkey(),
                profile: Self::profile_pda(&owner),
                vault: Self::vault_pda(&owner, id),
                treasury: TREASURY,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, &[heir])
    }
}

fn assert_err(r: Result<(), String>, needle: &str) {
    let logs = r.expect_err("giao dịch lẽ ra phải bị từ chối");
    assert!(logs.contains(needle), "mong lỗi `{needle}`, nhận: {logs}");
}

#[test]
fn payment_is_check_in_and_prepay_is_capped_at_90_days() {
    let mut e = Env::new();
    e.init_profile();
    let t0 = e.now();
    assert_eq!(e.profile().paid_until, t0);

    e.pay(1).unwrap();
    assert_eq!(e.profile().paid_until, t0 + MONTH_SECONDS);
    assert_eq!(e.balance(&TREASURY), MONTHLY_PRICE_LAMPORTS);

    // Đã trả 30 ngày; trả thêm 2 tháng = 90 ngày → đúng giới hạn.
    e.pay(2).unwrap();
    assert_eq!(e.profile().paid_until, t0 + 3 * MONTH_SECONDS);
    // Thêm 1 tháng nữa vượt 90 ngày tính từ hiện tại.
    assert_err(e.pay(1), "PrepayLimitExceeded");
    assert_err(e.pay(0), "InvalidMonths");
    assert_eq!(e.balance(&TREASURY), 3 * MONTHLY_PRICE_LAMPORTS);
}

#[test]
fn payment_must_go_to_the_fixed_treasury() {
    let mut e = Env::new();
    e.init_profile();
    let attacker = Keypair::new().pubkey();
    assert_err(e.pay_with_treasury(1, attacker), "WrongTreasury");
}

#[test]
fn heir_can_claim_only_after_30_days_overdue_and_pays_the_debt_once() {
    let mut e = Env::new();
    e.init_profile();
    e.pay(1).unwrap();
    let b1 = e.funded();
    let b2 = e.funded();
    let v1 = e.create_vault(b1.pubkey());
    let v2 = e.create_vault(b2.pubkey());

    // Còn trong kỳ đã trả, và cả trong 30 ngày quá hạn: chưa được nhận.
    assert_err(e.claim(&b1, v1), "NotReleasedYet");
    e.advance(MONTH_SECONDS + 29 * DAY);
    assert_err(e.claim(&b1, v1), "NotReleasedYet");

    // Quá hạn đủ 30 ngày → bàn giao. Người nhận đầu tiên trả nợ 1 tháng.
    e.advance(DAY);
    let treasury_before = e.balance(&TREASURY);
    e.claim(&b1, v1).unwrap();
    assert!(e.vault(v1).claimed);
    assert_eq!(e.balance(&TREASURY) - treasury_before, MONTHLY_PRICE_LAMPORTS);

    // Người nhận thứ hai của cùng A không phải trả lại khoản nợ đó.
    e.claim(&b2, v2).unwrap();
    assert!(e.vault(v2).claimed);
    assert_eq!(e.balance(&TREASURY) - treasury_before, MONTHLY_PRICE_LAMPORTS);

    // Không nhận lại lần hai.
    assert_err(e.claim(&b1, v1), "AlreadyClaimed");
}

#[test]
fn only_the_designated_heir_can_claim() {
    let mut e = Env::new();
    e.init_profile();
    let b = e.funded();
    let stranger = e.funded();
    let v = e.create_vault(b.pubkey());
    e.advance(31 * DAY);
    assert_err(e.claim(&stranger, v), "NotHeir");
    e.claim(&b, v).unwrap();
}

#[test]
fn owner_paying_before_heir_claims_cancels_the_handover() {
    let mut e = Env::new();
    e.init_profile();
    e.pay(1).unwrap();
    let b = e.funded();
    let v = e.create_vault(b.pubkey());

    // A quá hạn 65 ngày (đã tới hạn bàn giao) nhưng B chưa nhận; A quay lại thanh toán.
    e.advance(MONTH_SECONDS + 35 * DAY);
    // 1 tháng không đủ che phần quá hạn.
    assert_err(e.pay(1), "StillOverdue");
    e.pay(3).unwrap();
    assert!(e.profile().paid_until > e.now());
    assert_err(e.claim(&b, v), "NotReleasedYet");
}

#[test]
fn claimed_vault_is_final() {
    let mut e = Env::new();
    e.init_profile();
    let b = e.funded();
    let other = e.funded();
    let v = e.create_vault(b.pubkey());
    e.advance(31 * DAY);
    e.claim(&b, v).unwrap();
    assert_err(e.update_vault(v, other.pubkey()), "AlreadyClaimed");
    assert_err(e.delete_vault(v), "AlreadyClaimed");
}

#[test]
fn owner_can_change_heir_and_delete_vault_and_profile_with_rent_refund() {
    let mut e = Env::new();
    e.init_profile();
    let b = e.funded();
    let c = e.funded();
    let v = e.create_vault(b.pubkey());

    e.update_vault(v, c.pubkey()).unwrap();
    assert_eq!(e.vault(v).heir, c.pubkey());
    assert_eq!(e.vault(v).uri, "ipfs://bafy-v2");
    assert_err(e.update_vault(v, e.a.pubkey()), "HeirIsOwner");

    assert_err(e.close_profile(), "VaultsRemaining");
    let before = e.balance(&e.a.pubkey());
    e.delete_vault(v).unwrap();
    assert!(e.svm.get_account(&Env::vault_pda(&e.a.pubkey(), v)).map_or(true, |a| a.lamports == 0));
    assert!(e.balance(&e.a.pubkey()) > before, "cọc rent của két phải được hoàn");

    e.close_profile().unwrap();
    assert!(e.svm.get_account(&Env::profile_pda(&e.a.pubkey())).map_or(true, |a| a.lamports == 0));
}

#[test]
fn heir_cannot_be_the_owner() {
    let mut e = Env::new();
    e.init_profile();
    let a = e.a.insecure_clone();
    let ix = Instruction::new_with_bytes(
        lifenext::id(),
        &lifenext::instruction::CreateVault { heir: a.pubkey(), uri: "ipfs://x".into(), content_hash: [0; 32] }.data(),
        lifenext::accounts::CreateVault {
            payer: a.pubkey(),
            owner: a.pubkey(),
            profile: Env::profile_pda(&a.pubkey()),
            vault: Env::vault_pda(&a.pubkey(), 0),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    assert_err(e.send(ix, &[&a]), "HeirIsOwner");
}
