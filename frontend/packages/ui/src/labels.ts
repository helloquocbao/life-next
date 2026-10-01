/** Nhãn tiếng Việt cho mọi enum — một nguồn duy nhất cho cả App (Owner+Trustee) lẫn Admin Console. */
import type { AuditActorType, CheckInChannel, ContactResponse, EvidenceKind, LifecycleState, ReleaseReason, ReleaseStatus, ReviewDecision, RiskSeverity, TrusteeRole, TrusteeStatus } from '@deathnote/api';

export const lifecycleStateLabel: Record<LifecycleState, string> = {
  0: 'Bình thường',
  1: 'Quá hạn check-in',
  2: 'Đang báo người thân',
  3: 'Đang xác minh',
  4: 'Đang thẩm định',
  5: 'Chờ cuối',
  6: 'Đã bàn giao',
};

/** Màu tag theo mức độ: xanh → hổ phách → đỏ. */
export const lifecycleStateColor: Record<LifecycleState, string> = {
  0: 'green', 1: 'gold', 2: 'orange', 3: 'volcano', 4: 'volcano', 5: 'red', 6: 'default',
};

export const checkInChannelLabel: Record<CheckInChannel, string> = {
  0: 'Ứng dụng', 1: 'Web', 2: 'Link email', 3: 'Link SMS',
};

// Nhãn "vai trò" viết lại bằng ngôn ngữ đời thường — người dùng không cần biết khái niệm
// "mảnh khoá Shamir". Họ chỉ cần hiểu: ai được QUYỀT ĐỊNH mở, ai chỉ NHẬN thông tin.
export const trusteeRoleLabel: Record<TrusteeRole, string> = {
  0: 'Người cùng quyết định mở', 1: 'Người chỉ nhận thông tin', 2: 'Người xác nhận tình huống',
};

export const trusteeRoleHint: Record<TrusteeRole, string> = {
  0: 'Cùng với những người khác, quyết định khi nào mở thông tin cho gia đình. Cần đủ số người đồng ý — không một mình ai tự ý mở được.',
  1: 'Chỉ nhận đúng phần bạn để lại cho họ, sau khi thông tin đã được mở. Không tham gia quyết định.',
  2: 'Có thể báo "không liên lạc được" và gửi giấy tờ chứng minh, nhưng không có quyền tự quyết định mở.',
};

export const trusteeStatusLabel: Record<TrusteeStatus, string> = { 0: 'Chờ xác nhận', 1: 'Đã xác nhận', 2: 'Không phản hồi', 3: 'Chưa gửi lời mời' };
export const trusteeStatusColor: Record<TrusteeStatus, string> = { 0: 'gold', 1: 'green', 2: 'red', 3: 'default' };

export const contactResponseLabel: Record<ContactResponse, string> = { 0: 'Vẫn liên lạc được', 1: 'Không liên lạc được' };

export const releaseReasonLabel: Record<ReleaseReason, string> = {
  0: 'Mất liên lạc', 1: 'Nhập viện', 2: 'Tai nạn', 3: 'Đã mất',
};

export const releaseStatusLabel: Record<ReleaseStatus, string> = {
  0: 'Đang chờ đồng thuận',
  1: 'Chờ phiếu thẩm định',
  2: 'Chờ phiếu phê duyệt',
  3: 'Cần bổ sung bằng chứng',
  4: 'Đang trong thời gian chờ cuối',
  5: 'Đã mở',
  6: 'Từ chối',
  7: 'Owner đã huỷ',
};

export const releaseStatusColor: Record<ReleaseStatus, string> = {
  0: 'blue', 1: 'gold', 2: 'gold', 3: 'orange', 4: 'volcano', 5: 'green', 6: 'red', 7: 'default',
};

export const reviewDecisionLabel: Record<ReviewDecision, string> = { 0: 'Duyệt', 1: 'Yêu cầu bổ sung', 2: 'Từ chối' };

export const evidenceKindLabel: Record<EvidenceKind, string> = {
  0: 'Giấy chứng tử', 1: 'Giấy nhập viện', 2: 'Giấy tờ tuỳ thân', 3: 'Bản khai có chữ ký', 9: 'Khác',
};

export const riskSeverityLabel: Record<RiskSeverity, string> = { 0: 'Thấp', 1: 'Trung bình', 2: 'Cao' };
export const riskSeverityColor: Record<RiskSeverity, string> = { 0: 'blue', 1: 'orange', 2: 'red' };

export const auditActorTypeLabel: Record<AuditActorType, string> = {
  0: 'Hệ thống', 1: 'Owner', 2: 'Người được uỷ quyền', 3: 'Admin', 4: 'Ẩn danh',
};

/** Nhãn hành động audit log (khớp AuditActions.cs). */
export const auditActionLabel: Record<string, string> = {
  'owner.onboarding_completed': 'Hoàn tất thiết lập',
  'owner.check_in': 'Check-in "Tôi vẫn ổn"',
  'owner.schedule_changed': 'Đổi nhịp check-in',
  'owner.paused': 'Bật chế độ tạm dừng',
  'owner.resumed': 'Tắt chế độ tạm dừng',
  'owner.veto': 'Owner phủ quyết — huỷ tiến trình',
  'owner.2fa_enabled': 'Bật xác thực hai lớp',
  'owner.2fa_disabled_via_recovery': 'Tắt xác thực hai lớp bằng 12 từ khôi phục',
  'owner.staff_contact_preference_changed': 'Đổi tuỳ chọn nhân viên liên hệ khi đến hạn',
  'vault.initialized': 'Tạo két dữ liệu',
  'vault.item_created': 'Thêm hạng mục',
  'vault.item_updated': 'Sửa hạng mục',
  'vault.item_deleted': 'Xoá hạng mục',
  'vault.keys_distributed': 'Phân mảnh khoá & phân bổ',
  'vault.abandoned': 'Từ bỏ két cũ, tạo két mới',
  'trustee.added': 'Thêm người được uỷ quyền (chưa gửi lời mời)',
  'trustee.invited': 'Mời người được uỷ quyền',
  'trustee.updated': 'Cập nhật người được uỷ quyền',
  'trustee.removed': 'Xoá người được uỷ quyền',
  'trustee.accepted': 'Người được uỷ quyền chấp nhận',
  'trustee.keyring_created': 'Người được uỷ quyền tạo khoá',
  'trustee.contact_response': 'Phản hồi liên lạc',
  'lifecycle.state_changed': 'Chuyển trạng thái',
  'lifecycle.reminder_sent': 'Gửi nhắc check-in',
  'release.initiated': 'Khởi tạo yêu cầu mở',
  'release.consented': 'Đồng thuận mở',
  'release.evidence_uploaded': 'Nộp bằng chứng',
  'release.evidence_viewed': 'Admin xem bằng chứng',
  'release.evidence_purged': 'Tự xoá bằng chứng',
  'release.review_vote': 'Phiếu thẩm định',
  'release.final_wait_started': 'Bắt đầu chờ cuối',
  'release.completed': 'Đã bàn giao',
  'release.rejected': 'Từ chối yêu cầu mở',
  'release.cancelled': 'Huỷ yêu cầu mở',
  'release.data_accessed': 'Mở hộp nhận',
  'admin.email_template_updated': 'Sửa mẫu email',
  'admin.email_template_reset': 'Khôi phục mẫu email mặc định',
};
