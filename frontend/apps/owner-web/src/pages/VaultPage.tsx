/** Két thông tin: tài khoản & mật khẩu, giấy tờ, thư & lời nhắn, hướng dẫn cho gia đình. */
import { UnlockGate } from '../components/UnlockGate';
import { ItemsWorkspace } from '../components/ItemsWorkspace';

export function VaultPage() {
  return (
    <UnlockGate>
      <div className="page">
        <ItemsWorkspace section="vault" title="Két thông tin"
          subtitle="Mã hoá đầu-cuối — chỉ bạn và người bạn phân quyền (khi hồ sơ được mở) đọc được." />
      </div>
    </UnlockGate>
  );
}
