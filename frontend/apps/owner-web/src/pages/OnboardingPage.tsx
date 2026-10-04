/**
 * ONBOARDING — 5 bước GIỚI THIỆU sản phẩm, dưới 3 phút. Đây KHÔNG phải nơi tạo két.
 *   1. Chào & cam kết riêng tư   — "Chúng tôi không đọc được nội dung của bạn."
 *   2. Giới thiệu Két thông tin  — loại thông tin cất được ở đây, hoàn toàn mã hoá.
 *   3. Giới thiệu nhịp nhắc      — vì sao cần xác nhận định kỳ, chọn nhịp 7/14/30/90 ngày.
 *   4. Giới thiệu người thân     — ai sẽ nhận thông tin, vai trò của họ, mời 1 người (có thể để sau).
 *   5. Giới thiệu "nếu có chuyện xảy ra" — toàn bộ quy trình từng bước, nhấn mạnh owner luôn huỷ được.
 *
 * Việc TẠO KÉT (đặt mật khẩu chính + nhận 12 từ khôi phục) cố ý KHÔNG nằm ở đây — nó chỉ xuất hiện
 * khi owner thật sự vào tính năng Két lần đầu (xem components/UnlockGate.tsx). Lý do: bắt nhập mật
 * khẩu ngay giữa lúc giới thiệu, trước khi owner hiểu Két dùng để làm gì, gây rối và mất tập trung.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { App, Alert, Button, Card, Col, Flex, Form, Input, Radio, Result, Row, Slider, Space, Steps, Timeline, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { TrusteeRole, unwrap } from '@deathnote/api';
import { Brand, ErrorAlert, FullPageSpin, LegalNotice, colors, trusteeRoleHint, trusteeRoleLabel } from '@deathnote/ui';
import { api, auth } from '../config';
import { KINDS } from '../lib/itemKinds';
import { useOwnerStatus, useSaveTrustee } from '../lib/api-hooks';

export function OnboardingPage() {
  const status = useOwnerStatus();
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  // Nhịp chọn ở bước 3 cần dùng lại ở bước 5 (giải thích timeline) — nâng state lên đây.
  const [interval, setInterval] = useState(30);
  const [grace, setGrace] = useState(14);

  if (status.isLoading) return <FullPageSpin />;

  return (
    <div className="page-narrow" style={{ paddingTop: 32 }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <Brand />
        <Button type="link" onClick={() => auth.logout()}>Đăng xuất</Button>
      </Flex>
      <Steps current={step} size="small" responsive={false} style={{ marginBottom: 24 }} items={Array.from({ length: 5 }, () => ({ title: '' }))} />
      <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: -16, marginBottom: 16 }}>
        Bước {step + 1} / 5
      </Typography.Text>
      <Card>
        {step === 0 && <StepPrivacy onNext={() => setStep(1)} />}
        {step === 1 && <StepVaultIntro defaultName={status.data?.displayName ?? ''} onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepScheduleIntro interval={interval} grace={grace} onChangeInterval={setInterval} onChangeGrace={setGrace}
            onNext={() => setStep(3)} />
        )}
        {step === 3 && <StepTrusteeIntro onDone={() => setStep(4)} />}
        {step === 4 && (
          <StepWhatHappens interval={interval} grace={grace} onDone={() => navigate('/', { replace: true })} />
        )}
      </Card>
    </div>
  );
}

function StepPrivacy({ onNext }: { onNext: () => void }) {
  const navigate = useNavigate();
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SafetyCertificateOutlined style={{ fontSize: 48, color: colors.primary }} />
      <Typography.Title level={2} style={{ margin: 0 }}>Chúng tôi không đọc được nội dung của bạn.</Typography.Title>
      <Typography.Paragraph style={{ fontSize: 18, lineHeight: 1.6 }}>
        Mọi thông tin bạn lưu ở đây được khoá lại ngay trên điện thoại/máy tính của bạn, trước khi gửi đi.
        Chúng tôi chỉ giữ giúp bạn một hộp đã khoá — không ai mở được, kể cả nhân viên của chúng tôi.
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" style={{ fontSize: 16 }}>
        Nếu một ngày bạn không thể tự lo liệu và không còn bấm "Tôi vẫn ổn", hộp này chỉ được trao cho đúng những người bạn chọn,
        sau khi người nhắc nhở đã có thời gian liên lạc với bạn. Ở bất kỳ lúc nào trước đó, bạn chỉ cần chạm một nút là mọi thứ dừng lại ngay.
      </Typography.Paragraph>
      <LegalNotice />
      <Button type="primary" size="large" block onClick={onNext} style={{ height: 52, fontSize: 17 }}>Bắt đầu</Button>
      <Button type="link" block onClick={() => navigate('/assignments')}>
        Bỏ qua — tôi chỉ cần giữ khoá giúp người khác, không tạo két của riêng mình
      </Button>
    </Space>
  );
}

/** Bước 2: chỉ GIỚI THIỆU tính năng Két — chưa hỏi mật khẩu. Tiện thể xin tên hiển thị để tạo hồ sơ. */
function StepVaultIntro({ defaultName, onNext }: { defaultName: string; onNext: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const vaultKinds = KINDS.filter((k) => k.section === 'vault');

  const onFinish = async (v: { displayName: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      // Chỉ tạo hồ sơ owner với nhịp mặc định — CHƯA đụng gì tới két. Nhịp thật chọn ở bước sau.
      await unwrap(api.POST('/api/app/owner/complete-onboarding', {
        body: { displayName: v.displayName, checkInIntervalDays: 30, graceDays: 14 },
      }));
      onNext();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={{ displayName: defaultName }} size="large">
      <Typography.Title level={3} style={{ marginTop: 0 }}>Két thông tin của bạn</Typography.Title>
      <Typography.Paragraph style={{ fontSize: 16 }}>
        Đây là nơi bạn cất giữ những thông tin quan trọng — hoàn toàn mã hoá, chỉ mình bạn đọc được
        cho tới khi thật sự cần bàn giao.
      </Typography.Paragraph>
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {vaultKinds.map((k) => (
          <Col xs={12} key={k.kind}>
            <Space align="start">
              <span style={{ fontSize: 22 }}>{k.emoji}</span>
              <span style={{ fontSize: 14 }}>{k.label}</span>
            </Space>
          </Col>
        ))}
      </Row>
      <Typography.Paragraph type="secondary" style={{ fontSize: 14 }}>
        Bạn sẽ tạo mật khẩu riêng để khoá két này ở bước sau, ngay khi vào mục "Két thông tin" lần đầu —
        chưa cần nghĩ tới việc đó bây giờ.
      </Typography.Paragraph>
      <Form.Item name="displayName" label="Tên bạn muốn người thân nhìn thấy" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
        <Input />
      </Form.Item>
      <ErrorAlert error={error} style={{ marginBottom: 16 }} />
      <Button type="primary" htmlType="submit" block loading={busy} style={{ height: 52, fontSize: 17 }}>Tiếp tục</Button>
    </Form>
  );
}

/** Bước 3: giới thiệu khái niệm "nhịp nhắc" + để owner chọn luôn (dùng lại ở bước 5). */
function StepScheduleIntro({ interval, grace, onChangeInterval, onChangeGrace, onNext }: {
  interval: number; grace: number; onChangeInterval: (v: number) => void; onChangeGrace: (v: number) => void; onNext: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await unwrap(api.PUT('/api/app/owner/schedule', { body: { checkInIntervalDays: interval, graceDays: grace } }));
      onNext();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Chúng tôi cần biết bạn vẫn ổn</Typography.Title>
      <Typography.Paragraph style={{ fontSize: 16 }}>
        Cứ sau một khoảng thời gian, chúng tôi sẽ nhắc bạn xác nhận "vẫn ổn" — chỉ một chạm. Nếu bạn
        không phản hồi sau nhiều lần nhắc, chúng tôi mới bắt đầu báo cho người nhắc nhở bạn đã chọn.
      </Typography.Paragraph>
      <Radio.Group value={interval} onChange={(e) => onChangeInterval(e.target.value)} optionType="button" buttonStyle="solid" size="large"
        style={{ width: '100%', display: 'flex' }}
        options={[7, 14, 30, 90].map((d) => ({ value: d, label: `${d} ngày`, style: { flex: 1, textAlign: 'center' as const, paddingInline: 2, minWidth: 0, fontSize: 15, whiteSpace: 'nowrap' as const } }))} />
      <div>
        <div style={{ marginBottom: 8 }}>Số ngày người nhắc nhở có để liên lạc với bạn trước khi thông tin được gửi đi: <b>{grace} ngày</b></div>
        <Slider min={7} max={30} value={grace} onChange={onChangeGrace} />
      </div>
      <ErrorAlert error={error} />
      <Button type="primary" size="large" block onClick={save} loading={busy} style={{ height: 52, fontSize: 17 }}>Tiếp tục</Button>
    </Space>
  );
}

/** Bước 4: giới thiệu hai vai trò (người nhắc nhở, người nhận thông tin) + thêm 1 người (chưa gửi lời mời, có thể để sau). */
function StepTrusteeIntro({ onDone }: { onDone: () => void }) {
  const save = useSaveTrustee();
  const { message } = App.useApp();
  const [sent, setSent] = useState(false);

  const onFinish = async (v: { displayName: string; email: string; relationship?: string; role: TrusteeRole }) => {
    await save.mutateAsync({ body: v });
    message.success('Đã thêm.');
    setSent(true);
  };

  if (sent) {
    return (
      <Result status="success" title="Đã thêm!"
        subTitle={'Người này CHƯA nhận được thông báo gì. Người nhắc nhở sẽ được mời tự động khi bạn bỏ lỡ xác nhận "vẫn ổn"; người nhận thông tin cần được mời sớm (mục Người thân) để họ tạo khoá cá nhân.'}
        extra={<Button type="primary" size="large" onClick={onDone} style={{ height: 52, fontSize: 17, paddingInline: 32 }}>Tiếp tục</Button>} />
    );
  }

  return (
    <Form layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={{ role: TrusteeRole.Reminder }} size="large">
      <Typography.Title level={3} style={{ marginTop: 0 }}>Ai sẽ nhận thông tin của bạn?</Typography.Title>
      <Typography.Paragraph style={{ fontSize: 16 }}>
        Bạn chọn những người thân tin cậy với hai việc khác nhau: <b>người nhắc nhở</b> được báo trước để nhắc bạn bấm "Tôi vẫn ổn",
        và <b>người nhận thông tin</b> tự động nhận phần bạn cho phép nếu bạn vẫn không bấm sau thời gian chờ.
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" style={{ fontSize: 14 }}>
        Thêm một người ngay bây giờ để hình dung rõ hơn — hoặc bấm "Để sau" và thêm họ lúc khác trong mục Người thân.
      </Typography.Paragraph>
      <Form.Item name="displayName" label="Họ tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}><Input /></Form.Item>
      <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email chưa hợp lệ' }]}><Input /></Form.Item>
      <Form.Item name="relationship" label="Là ai với bạn?"><Input placeholder="Vợ/chồng, con, bạn thân…" /></Form.Item>
      <Form.Item name="role" label="Vai trò của họ">
        <Radio.Group>
          <Space direction="vertical" size="middle">
            {[TrusteeRole.Reminder, TrusteeRole.Recipient].map((r) => (
              <Card key={r} size="small" style={{ width: '100%' }}>
                <Radio value={r}>
                  <b>{trusteeRoleLabel[r]}</b>
                  <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>{trusteeRoleHint[r]}</div>
                </Radio>
              </Card>
            ))}
          </Space>
        </Radio.Group>
      </Form.Item>
      <ErrorAlert error={save.error} style={{ marginBottom: 16 }} />
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button type="primary" htmlType="submit" block loading={save.isPending} style={{ height: 52, fontSize: 17 }}>Thêm người này</Button>
        <Button block onClick={onDone}>Để sau</Button>
      </Space>
    </Form>
  );
}

/** Bước 5: giải thích toàn bộ quy trình "nếu có chuyện xảy ra" — không thu thập gì thêm. */
function StepWhatHappens({ interval, grace, onDone }: { interval: number; grace: number; onDone: () => void }) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Nếu bạn không còn bấm nút</Typography.Title>
      <Typography.Paragraph style={{ fontSize: 16 }}>
        Đây là toàn bộ những gì sẽ diễn ra — từng bước một, không có bước nào bị bỏ qua.
      </Typography.Paragraph>
      <Card size="small" style={{ background: colors.primarySoft, borderColor: colors.primarySoft }}>
        <Timeline style={{ marginTop: 4, marginBottom: -16 }} items={[
          { color: 'green', children: `Ngày ${interval}: đến hạn xác nhận "vẫn ổn".` },
          { color: 'gold', children: 'Vài ngày sau: chúng tôi nhắc bạn qua thông báo, email, tin nhắn — mỗi tin có nút "Tôi vẫn ổn" bấm là xong.' },
          { color: 'orange', children: 'Nếu vẫn không có phản hồi: người nhắc nhở bạn chọn được báo "hãy liên lạc với bạn, nhắc bạn bấm Tôi vẫn ổn". Họ KHÔNG xem được gì.' },
          { color: 'red', children: `Sau ${grace} ngày chờ thêm mà bạn vẫn không bấm: hệ thống tự động gửi cho người nhận thông tin đúng phần bạn đã chọn cho họ.` },
          { color: 'gray', children: 'Ở BẤT KỲ lúc nào trong toàn bộ quá trình này, bạn chỉ cần xác nhận "vẫn ổn" là mọi thứ dừng lại ngay lập tức.' },
        ]} />
      </Card>
      <Alert type="info" showIcon title="Death Note bàn giao thông tin, không xác nhận tình trạng tử vong và không thay thế di chúc hợp pháp." />
      <Button type="primary" size="large" block onClick={onDone} style={{ height: 52, fontSize: 17 }}>Hoàn tất, vào trang chủ</Button>
    </Space>
  );
}
