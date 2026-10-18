use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Phải thanh toán ít nhất 1 tháng")]
    InvalidMonths,
    #[msg("Chỉ được trả trước tối đa 90 ngày")]
    PrepayLimitExceeded,
    #[msg("Khoản thanh toán chưa đủ để che phần đã quá hạn")]
    StillOverdue,
    #[msg("Chưa tới hạn bàn giao")]
    NotReleasedYet,
    #[msg("Két đã được người nhận lấy")]
    AlreadyClaimed,
    #[msg("Người ký không phải người nhận của két này")]
    NotHeir,
    #[msg("Đường dẫn dữ liệu quá dài")]
    UriTooLong,
    #[msg("Người nhận không được là chính chủ két")]
    HeirIsOwner,
    #[msg("Còn két chưa xoá")]
    VaultsRemaining,
    #[msg("Sai ví nhận phí")]
    WrongTreasury,
    #[msg("Tràn số")]
    Overflow,
}
