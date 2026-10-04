/**
 * Màn hình lời mời (công khai — xem được khi chưa đăng nhập).
 *
 * Luồng: xem lời mời → "Chấp nhận vai trò" → (chưa đăng nhập ⇒ form đăng nhập/đăng ký nhúng ngay trong
 *        trang, gọi REST API, không rời trang) → (CHỈ người nhận thông tin, chưa có khoá cá nhân ⇒ tạo khoá)
 *        → accept-invitation. Người nhắc nhở không cần khoá.
 *
 * Thứ tự "tạo khoá TRƯỚC khi chấp nhận" giúp backend gắn luôn khoá công khai vào hồ sơ khi accept,
 * để owner có thể niêm phong phần dành cho người này ngay.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert, App, Button, Card, Result, Typography } from 'antd';
import { TrusteeRole } from '@deathnote/api';
import { ErrorAlert, FullPageSpin, LegalNotice, LoginForm } from '@deathnote/ui';
import { auth } from '../config';
import { useCurrentUser } from '../auth/useCurrentUser';
import { KeyringSetupForm } from '../components/trustee/KeyringSetupForm';
import { useAcceptInvitation, useInvitation, useKeyring } from '../lib/trusteePortalHooks';
import { roleExplainer, roleLabel } from '../lib/trusteeLabels';

export function InvitePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const user = useCurrentUser();
  const invitation = useInvitation(token);
  const keyring = useKeyring(!!user);
  const accept = useAcceptInvitation();
  const [step, setStep] = useState<'view' | 'auth' | 'keyring'>('view');
  const [justSignedIn, setJustSignedIn] = useState(false);

  const doAccept = () =>
    accept.mutate(token, {
      onSuccess: () => {
        message.success('Bạn đã nhận vai trò. Cảm ơn bạn.');
        navigate('/assignments', { replace: true });
      },
    });

  const needsKey = invitation.data?.role === TrusteeRole.Recipient;

  const onAcceptClick = () => {
    if (!user) return setStep('auth');
    // Chỉ người nhận thông tin cần khoá cá nhân (phần dành cho họ được niêm phong bằng khoá công khai đó).
    if (needsKey && !keyring.data?.exists) return setStep('keyring');
    doAccept();
  };

  if (!token)
    return <Result status="warning" title="Thiếu mã lời mời" subTitle="Hãy mở lại đường link đầy đủ trong email mời." />;
  if (invitation.isLoading || user === undefined) return <FullPageSpin tip="Đang tải lời mời…" />;
  if (invitation.error)
    return (
      <Card>
        <Result status="warning" title="Lời mời không còn hiệu lực"
          subTitle="Đường link có thể đã hết hạn hoặc đã được dùng. Hãy liên hệ người đã mời bạn để nhận link mới." />
        <ErrorAlert error={invitation.error} />
      </Card>
    );

  const inv = invitation.data!;

  if (step === 'auth')
    return (
      <>
        <Typography.Paragraph type="secondary">
          Đăng nhập hoặc tạo tài khoản để nhận vai trò {inv.ownerName} giao cho bạn.
        </Typography.Paragraph>
        <LoginForm auth={auth} embedded onSuccess={() => { setJustSignedIn(true); setStep('view'); }} />
        <Button type="link" style={{ paddingLeft: 0, marginTop: 8 }} onClick={() => setStep('view')}>← Quay lại lời mời</Button>
      </>
    );

  if (step === 'keyring')
    return (
      <Card>
        <KeyringSetupForm submitText="Tạo khoá và chấp nhận vai trò" onDone={doAccept} />
        <ErrorAlert error={accept.error} style={{ marginTop: 16 }} />
      </Card>
    );

  const explainer = inv.role !== undefined ? roleExplainer[inv.role] : null;

  return (
    <Card>
      {justSignedIn && user && (
        <Alert type="success" showIcon style={{ marginBottom: 16 }} title="Đã đăng nhập. Bấm “Chấp nhận vai trò” để tiếp tục." />
      )}
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>Xin chào {inv.trusteeName},</Typography.Paragraph>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Anh/Chị {inv.ownerName} đã chọn bạn làm {roleLabel(inv.role).toLowerCase()}
      </Typography.Title>
      {inv.relationship && <Typography.Paragraph type="secondary">Mối quan hệ: {inv.relationship}</Typography.Paragraph>}

      {explainer && (
        <div style={{ fontSize: 17, lineHeight: 1.7 }}>
          {explainer.map((s) => <p key={s} style={{ margin: '0 0 10px' }}>{s}</p>)}
        </div>
      )}

      <Button type="primary" size="large" block style={{ height: 60, fontSize: 18, marginTop: 16 }}
        loading={accept.isPending || (!!user && keyring.isLoading)} onClick={onAcceptClick}>
        Chấp nhận vai trò
      </Button>
      <ErrorAlert error={accept.error ?? keyring.error} style={{ marginTop: 12 }} />

      <LegalNotice style={{ marginTop: 24 }} />
    </Card>
  );
}
