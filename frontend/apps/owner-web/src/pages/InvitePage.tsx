/**
 * Màn hình link trong email (công khai — xem được khi chưa đăng nhập). Hai trường hợp:
 *
 *  1) LỜI MỜI (người nhắc nhở): xem lời mời → "Chấp nhận vai trò" → (chưa đăng nhập ⇒ form đăng nhập/đăng ký nhúng ngay
 *     trong trang, gọi REST API, không rời trang) → accept-invitation → danh sách hồ sơ. Không cần khoá cá nhân.
 *
 *  2) NHẬN THÔNG TIN (người nhận, `isDelivery`): người nhận mặc định không biết gì từ trước; link này chỉ đến khi owner
 *     gặp sự cố. Bấm "Xem thông tin" → (chưa có tài khoản ⇒ đăng ký = tạo mật khẩu; có rồi ⇒ đăng nhập) → tự gắn link vào
 *     tài khoản → mở thẳng hộp nhận.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert, App, Button, Card, Result, Typography } from 'antd';
import { ErrorAlert, FullPageSpin, LegalNotice, LoginForm } from '@deathnote/ui';
import { auth } from '../config';
import { useCurrentUser } from '../auth/useCurrentUser';
import { useAcceptInvitation, useInvitation } from '../lib/trusteePortalHooks';
import { roleExplainer, roleLabel } from '../lib/trusteeLabels';

export function InvitePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const user = useCurrentUser();
  const invitation = useInvitation(token);
  const accept = useAcceptInvitation();
  const [step, setStep] = useState<'view' | 'auth'>('view');
  const [justSignedIn, setJustSignedIn] = useState(false);

  const isDelivery = !!invitation.data?.isDelivery;

  const doAccept = () =>
    accept.mutate(token, {
      onSuccess: (a) => {
        if (isDelivery && a.trusteeId) {
          navigate(`/inbox/${a.trusteeId}`, { replace: true });
        } else {
          message.success('Bạn đã nhận vai trò. Cảm ơn bạn.');
          navigate('/assignments', { replace: true });
        }
      },
    });

  const onAcceptClick = () => {
    if (!user) return setStep('auth');
    doAccept();
  };

  if (!token)
    return <Result status="warning" title="Thiếu mã" subTitle="Hãy mở lại đường link đầy đủ trong email." />;
  if (invitation.isLoading || user === undefined) return <FullPageSpin tip="Đang tải…" />;
  if (invitation.error)
    return (
      <Card>
        <Result status="warning" title="Đường link không còn hiệu lực"
          subTitle="Đường link có thể đã hết hạn hoặc đã được dùng. Nếu bạn đã tạo tài khoản, hãy đăng nhập vào Death Note để xem." />
        <ErrorAlert error={invitation.error} />
      </Card>
    );

  const inv = invitation.data!;

  if (step === 'auth')
    return (
      <>
        <Typography.Paragraph type="secondary">
          {isDelivery
            ? `Để xem thông tin ${inv.ownerName} để lại cho bạn: nếu chưa có tài khoản, chọn "Đăng ký" bên dưới để tạo mật khẩu (dùng đúng email nhận thư này); nếu đã có, hãy đăng nhập.`
            : `Đăng nhập hoặc tạo tài khoản để nhận vai trò ${inv.ownerName} giao cho bạn.`}
        </Typography.Paragraph>
        <LoginForm auth={auth} embedded onSuccess={() => {
          setJustSignedIn(true);
          setStep('view');
          // Nhận thông tin: không cần thêm bước nào nữa — vào thẳng hộp nhận ngay sau khi đăng nhập.
          if (isDelivery) doAccept();
        }} />
        <Button type="link" style={{ paddingLeft: 0, marginTop: 8 }} onClick={() => setStep('view')}>← Quay lại</Button>
      </>
    );

  if (isDelivery)
    return (
      <Card>
        {justSignedIn && user && (
          <Alert type="success" showIcon style={{ marginBottom: 16 }} title="Đã đăng nhập. Bấm “Xem thông tin” để tiếp tục." />
        )}
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>Xin chào {inv.trusteeName},</Typography.Paragraph>
        <Typography.Title level={2} style={{ marginTop: 0 }}>{inv.ownerName} đã để lại thông tin cho bạn</Typography.Title>
        {inv.relationship && <Typography.Paragraph type="secondary">Mối quan hệ: {inv.relationship}</Typography.Paragraph>}
        <div style={{ fontSize: 17, lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 10px' }}>
            Chúng tôi rất tiếc phải gửi thông báo này. {inv.ownerName} đã chuẩn bị sẵn một số thông tin và lời nhắn dành riêng cho bạn.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            Nếu đây là lần đầu bạn dùng Death Note, bạn chỉ cần tạo một mật khẩu. Hãy xem khi bạn sẵn sàng — không có gì phải vội.
          </p>
        </div>
        <Button type="primary" size="large" block style={{ height: 60, fontSize: 18, marginTop: 16 }}
          loading={accept.isPending} onClick={onAcceptClick}>
          Xem thông tin
        </Button>
        <ErrorAlert error={accept.error} style={{ marginTop: 12 }} />
        <LegalNotice style={{ marginTop: 24 }} />
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
        loading={accept.isPending} onClick={onAcceptClick}>
        Chấp nhận vai trò
      </Button>
      <ErrorAlert error={accept.error} style={{ marginTop: 12 }} />

      <LegalNotice style={{ marginTop: 24 }} />
    </Card>
  );
}
