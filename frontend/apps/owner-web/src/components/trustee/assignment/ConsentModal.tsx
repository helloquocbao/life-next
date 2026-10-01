/**
 * "Tôi đồng ý mở" — đồng thuận là một HÀNH ĐỘNG MẬT MÃ, không chỉ là bấm nút:
 *
 *   1) Nhập passphrase → mở khoá riêng (X25519) trên trình duyệt.
 *   2) Lấy "vật liệu đồng thuận": mảnh khoá Shamir của mình (đã niêm phong cho mình) + khoá công khai
 *      của các người được uỷ quyền khác.
 *   3) Mở mảnh khoá, rồi NIÊM PHONG LẠI cho từng người nhận bằng khoá công khai của họ (sealed box).
 *   4) Gửi các bản niêm phong lên server. Server chỉ trao chúng cho người nhận SAU KHI hồ sơ được mở,
 *      và PICO không đọc được mảnh khoá nào.
 *
 * Khoá riêng và mảnh khoá rõ bị ghi đè 0 ngay sau khi dùng.
 */
import { App, Input, Modal, Typography } from 'antd';
import { useState } from 'react';
import { unwrap, type KeyringDto } from '@deathnote/api';
import { prepareConsentDeliveries, wipe } from '@deathnote/crypto';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../config';
import { unlockWithPassphrase } from '../../lib/keyring';
import { PassphraseForm } from '../PassphraseForm';

export function ConsentModal({ requestId, ownerName, keyring, open, onClose }: {
  requestId: string; ownerName: string; keyring: KeyringDto | undefined; open: boolean; onClose: () => void;
}) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [statement, setStatement] = useState('');

  const consent = async (passphrase: string, setProgress: (s: string) => void) => {
    // Bước 1: mở khoá riêng bằng passphrase (Argon2id — cố ý chậm vài giây).
    setProgress('Đang mở khoá cá nhân của bạn…');
    const keys = await unlockWithPassphrase(keyring, passphrase);
    try {
      // Bước 2: tải mảnh khoá của mình + khoá công khai người nhận.
      setProgress('Đang tải mảnh khoá…');
      const material = await unwrap(
        api.GET('/api/app/trustee-portal/consent-material/{requestId}', { params: { path: { requestId } } }),
      );
      if (!material.mySealedShare) throw new Error('Không tìm thấy mảnh khoá của bạn cho hồ sơ này.');
      const recipients = (material.recipients ?? [])
        .filter((r) => !!r.trusteeId && !!r.publicKey)
        .map((r) => ({ trusteeId: r.trusteeId, publicKey: r.publicKey }));

      // Bước 3: mở mảnh khoá và niêm phong lại cho từng người nhận — hoàn toàn trên trình duyệt.
      setProgress('Đang niêm phong lại mảnh khoá cho những người thân khác…');
      let deliveries;
      try {
        deliveries = await prepareConsentDeliveries(material.mySealedShare, keys, recipients);
      } catch {
        throw new Error('Không mở được mảnh khoá bằng khoá cá nhân này. Vui lòng liên hệ PICO.');
      }

      // Bước 4: gửi các bản niêm phong (server/PICO không đọc được).
      setProgress('Đang gửi đồng thuận…');
      await unwrap(
        api.POST('/api/app/trustee-portal/consent/{requestId}', {
          params: { path: { requestId } },
          body: { statement: statement.trim() || null, deliveries },
        }),
      );
    } finally {
      wipe(keys.privateKey);
    }
    await qc.invalidateQueries({ queryKey: ['trustee'] });
    message.success('Đã ghi nhận đồng thuận của bạn.');
    setStatement('');
    onClose();
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} destroyOnHidden maskClosable={false} title="Tôi đồng ý mở hồ sơ">
      <Typography.Paragraph>
        Đồng ý nghĩa là bạn chuyển mảnh khoá của mình — đã được niêm phong lại — cho những người thân khác.
        Mảnh khoá chỉ đến tay họ khi hồ sơ thực sự được mở. PICO không đọc được mảnh khoá nào.
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        {ownerName} vẫn có thể huỷ yêu cầu cho đến khi hồ sơ được mở.
      </Typography.Paragraph>
      <Input.TextArea value={statement} onChange={(e) => setStatement(e.target.value)} rows={2} maxLength={2000}
        placeholder="Ghi chú (không bắt buộc)" style={{ marginBottom: 16 }} />
      <PassphraseForm submitText="Tôi đồng ý mở" onSubmit={consent} />
    </Modal>
  );
}
