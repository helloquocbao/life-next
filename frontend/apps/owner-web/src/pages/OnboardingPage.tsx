/**
 * ONBOARDING — 5 bước, dưới 4 phút, viết cho người KHÔNG rành công nghệ.
 *   1. Chào & cam kết riêng tư   — "Chúng tôi không đọc được nội dung của bạn."
 *   2. Đặt mật khẩu chính        — (kỹ thuật: passphrase → khoá sinh trên thiết bị bằng Argon2id,
 *                                   nhưng KHÔNG dùng các từ này trước mặt người dùng)
 *   3. Bản in dự phòng 12 từ     — nhắc in ra giấy, cảnh báo mất là mất
 *   4. Chọn nhịp nhắc            — 7/14/30/90 ngày, phần "điều gì xảy ra" ẩn mặc định
 *   5. Thêm 1 người thân         — chỉ cần 1 người để hồ sơ có ý nghĩa (có thể để sau)
 *
 * Nguyên tắc xuyên suốt: mỗi màn hình MỘT quyết định, MỘT nút bấm chính, không thuật ngữ kỹ thuật.
 * Thuật ngữ mật mã (passphrase, Argon2id, m-of-n…) chỉ tồn tại trong code/comment, không hiện ra UI.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { App, Alert, Button, Card, Checkbox, Collapse, Flex, Form, Input, Radio, Result, Slider, Space, Steps, Timeline, Typography } from 'antd';
import { LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { createVault } from '@deathnote/crypto';
import { TrusteeRole, unwrap } from '@deathnote/api';
import { Brand, ErrorAlert, FullPageSpin, LegalNotice, colors, trusteeRoleHint, trusteeRoleLabel } from '@deathnote/ui';
import { api, auth } from '../config';
import { useOwnerStatus, useSaveTrustee } from '../lib/api-hooks';
import { useVaultSession } from '../session/vaultSession';

export function OnboardingPage() {
  const status = useOwnerStatus();
  const [step, setStep] = useState(0);
  const [phrase, setPhrase] = useState<string>();
  const navigate = useNavigate();

  // Người dùng đã tạo két trước đó (vd. tải lại trang giữa chừng) → nhảy tới bước phù hợp.
  useEffect(() => {
    if (!status.data || phrase) return;
    if (status.data.vaultInitialized) {
      if (!status.data.recoveryKitConfirmed) setStep(2);
      else navigate('/', { replace: true });
    }
  }, [status.data, phrase, navigate]);

  if (status.isLoading) return <FullPageSpin />;

  return (
    <div className="page-narrow" style={{ paddingTop: 32 }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <Brand />
        <Button type="link" onClick={() => auth.logout()}>Đăng xuất</Button>
      </Flex>
      {/* Chỉ hiện số bước hiện tại/tổng số — không hiện tên kỹ thuật của từng bước, tránh rối mắt. */}
      <Steps current={step} size="small" style={{ marginBottom: 24 }}
        items={Array.from({ length: 5 }, () => ({ title: '' }))} />
      <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: -16, marginBottom: 16 }}>
        Bước {step + 1} / 5
      </Typography.Text>
      <Card>
        {step === 0 && <StepPrivacy onNext={() => setStep(1)} />}
        {step === 1 && <StepMasterKey defaultName={status.data?.displayName ?? ''} onDone={(p) => { setPhrase(p); setStep(2); }} />}
        {step === 2 && <StepRecovery phrase={phrase} onNext={() => setStep(3)} />}
        {step === 3 && <StepSchedule onNext={() => setStep(4)} />}
        {step === 4 && <StepTrustee onDone={() => navigate('/', { replace: true })} />}
      </Card>
    </div>
  );
}

function StepPrivacy({ onNext }: { onNext: () => void }) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SafetyCertificateOutlined style={{ fontSize: 48, color: colors.primary }} />
      <Typography.Title level={2} style={{ margin: 0 }}>Chúng tôi không đọc được nội dung của bạn.</Typography.Title>
      <Typography.Paragraph style={{ fontSize: 18, lineHeight: 1.6 }}>
        Mọi thông tin bạn lưu ở đây được khoá lại ngay trên điện thoại/máy tính của bạn, trước khi gửi đi.
        Chúng tôi chỉ giữ giúp bạn một hộp đã khoá — không ai mở được, kể cả nhân viên của chúng tôi.
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" style={{ fontSize: 16 }}>
        Nếu một ngày bạn không thể tự lo liệu, hộp này chỉ được mở khi đủ số người thân bạn chọn cùng đồng ý.
        Ở bất kỳ lúc nào trước đó, bạn chỉ cần chạm một nút là mọi thứ dừng lại ngay.
      </Typography.Paragraph>
      <LegalNotice />
      <Button type="primary" size="large" block onClick={onNext} style={{ height: 52, fontSize: 17 }}>Bắt đầu</Button>
    </Space>
  );
}

/** Bước 2: tạo hồ sơ + tạo két. Kỹ thuật: mọi khoá sinh trên trình duyệt; server chỉ nhận bản đã bọc. */
function StepMasterKey({ defaultName, onDone }: { defaultName: string; onDone: (phrase: string) => void }) {
  const unlock = useVaultSession((s) => s.unlock);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const onFinish = async (v: { displayName: string; passphrase: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      await unwrap(api.POST('/api/app/owner/complete-onboarding', {
        body: { displayName: v.displayName, checkInIntervalDays: 30, graceDays: 14 },
      }));
      const { payload, vaultKey, recoveryPhrase } = await createVault(v.passphrase);
      await unwrap(api.POST('/api/app/vault/initialize', { body: payload }));
      unlock(vaultKey);
      await qc.invalidateQueries();
      onDone(recoveryPhrase);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={{ displayName: defaultName }} size="large">
      <Typography.Title level={3} style={{ marginTop: 0 }}><LockOutlined /> Đặt mật khẩu chính</Typography.Title>
      <Typography.Paragraph style={{ fontSize: 16 }}>
        Đây là mật khẩu duy nhất để mở hộp thông tin của bạn sau này. Hãy chọn một câu bạn dễ nhớ —
        ví dụ tên con bạn kèm một ngày kỷ niệm — nhưng người khác khó đoán được.
      </Typography.Paragraph>
      <Alert type="warning" showIcon style={{ marginBottom: 20 }}
        title="Chúng tôi không lưu mật khẩu này và không thể lấy lại giúp bạn nếu quên."
        description="Ở bước sau, bạn sẽ nhận một bản dự phòng 12 từ để dùng khi quên mật khẩu." />
      <Form.Item name="displayName" label="Tên bạn muốn người thân nhìn thấy" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="passphrase" label="Mật khẩu chính" rules={[{ required: true, min: 10, message: 'Cần ít nhất 10 ký tự' }]}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item name="confirm" label="Nhập lại mật khẩu chính" dependencies={['passphrase']}
        rules={[{ required: true, message: 'Vui lòng nhập lại' }, ({ getFieldValue }) => ({
          validator: (_, v) => (v === getFieldValue('passphrase') ? Promise.resolve() : Promise.reject('Hai lần nhập chưa khớp nhau')),
        })]}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <ErrorAlert error={error} style={{ marginBottom: 16 }} />
      <Button type="primary" htmlType="submit" block loading={busy} style={{ height: 52, fontSize: 17 }}>
        {busy ? 'Đang tạo, vui lòng đợi vài giây…' : 'Tiếp tục'}
      </Button>
    </Form>
  );
}

function StepRecovery({ phrase, onNext }: { phrase?: string; onNext: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    setBusy(true);
    try {
      await unwrap(api.POST('/api/app/owner/confirm-recovery-kit'));
      onNext();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Bản dự phòng khi quên mật khẩu</Typography.Title>
      {phrase ? (
        <>
          <Typography.Paragraph style={{ fontSize: 16 }}>
            Đây là 12 từ đặc biệt — nếu sau này bạn quên mật khẩu chính, dùng 12 từ này để lấy lại quyền truy cập.
          </Typography.Paragraph>
          <div className="recovery-grid">
            {phrase.split(' ').map((w, i) => <div key={i}><span className="muted">{i + 1}.</span> {w}</div>)}
          </div>
          <Button size="large" onClick={() => window.print()} className="no-print">In ra giấy ngay bây giờ</Button>
          <Alert type="warning" showIcon
            title="Hãy cất 12 từ này cùng giấy tờ quan trọng của bạn."
            description="Nếu mất cả điện thoại/máy tính lẫn 12 từ này, sẽ không ai — kể cả chúng tôi — lấy lại được thông tin cho bạn. Đừng chụp màn hình hay gửi qua tin nhắn." />
        </>
      ) : (
        <Alert type="info" showIcon title="12 từ này chỉ hiện một lần duy nhất. Nếu bạn đã chép lại rồi, hãy xác nhận bên dưới để tiếp tục." />
      )}
      <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ fontSize: 16 }}>
        Tôi đã cất giữ 12 từ này ở nơi an toàn.
      </Checkbox>
      <Button type="primary" size="large" block disabled={!confirmed} loading={busy} onClick={next} style={{ height: 52, fontSize: 17 }}>
        Tiếp tục
      </Button>
    </Space>
  );
}

/** Bước 4: chọn nhịp nhắc. Chi tiết "điều gì xảy ra" ẩn sau một nút bấm — không đập vào mắt ngay. */
function StepSchedule({ onNext }: { onNext: () => void }) {
  const [interval, setInterval] = useState(30);
  const [grace, setGrace] = useState(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const save = async () => {
    setBusy(true);
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
      <Typography.Title level={3} style={{ margin: 0 }}>Bao lâu bạn muốn xác nhận "tôi vẫn ổn" một lần?</Typography.Title>
      <Typography.Paragraph style={{ fontSize: 16 }}>Chọn khoảng thời gian thoải mái với bạn — có thể đổi lại sau này.</Typography.Paragraph>
      <Radio.Group value={interval} onChange={(e) => setInterval(e.target.value)} optionType="button" buttonStyle="solid" size="large"
        style={{ width: '100%', display: 'flex' }}
        options={[7, 14, 30, 90].map((d) => ({ value: d, label: `${d} ngày`, style: { flex: 1, textAlign: 'center' as const } }))} />

      <Collapse ghost items={[{
        key: '1',
        label: <span style={{ color: colors.primary, fontWeight: 600 }}>Xem điều gì sẽ xảy ra nếu tôi không phản hồi</span>,
        children: (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 8 }}>Thời gian chờ thêm sau khi hệ thống đã báo người thân: <b>{grace} ngày</b></div>
              <Slider min={7} max={30} value={grace} onChange={setGrace} />
            </div>
            <Card size="small" style={{ background: colors.primarySoft, borderColor: colors.primarySoft }}>
              <Timeline style={{ marginTop: 4, marginBottom: -16 }} items={[
                { color: 'green', children: `Ngày ${interval}: đến hạn xác nhận.` },
                { color: 'gold', children: `Vài ngày sau: chúng tôi nhắc bạn qua thông báo, email, tin nhắn — mỗi tin có nút "Tôi vẫn ổn" bấm là xong.` },
                { color: 'orange', children: `Nếu vẫn không có phản hồi: người thân bạn chọn được báo "hãy liên lạc với bạn". Họ CHƯA xem được gì.` },
                { color: 'red', children: `Sau ${grace} ngày chờ thêm: người thân mới có thể xin mở thông tin — vẫn cần đủ người đồng ý và qua kiểm tra kỹ.` },
                { color: 'gray', children: 'Ở bất kỳ lúc nào trong toàn bộ quá trình này, bạn chỉ cần xác nhận là mọi thứ dừng lại ngay.' },
              ]} />
            </Card>
          </Space>
        ),
      }]} style={{ marginTop: -12 }} />

      <ErrorAlert error={error} />
      <Button type="primary" size="large" block onClick={save} loading={busy} style={{ height: 52, fontSize: 17 }}>Tiếp tục</Button>
    </Space>
  );
}

function StepTrustee({ onDone }: { onDone: () => void }) {
  const save = useSaveTrustee();
  const { message } = App.useApp();
  const [sent, setSent] = useState(false);

  const onFinish = async (v: { displayName: string; email: string; relationship?: string; role: TrusteeRole }) => {
    await save.mutateAsync({ body: v });
    message.success('Đã gửi lời mời.');
    setSent(true);
  };

  if (sent) {
    return (
      <Result status="success" title="Xong rồi! Hồ sơ của bạn đã sẵn sàng."
        subTitle="Người thân sẽ nhận được email mời. Khi họ đồng ý, bạn quay lại mục Người nhận để hoàn tất."
        extra={<Button type="primary" size="large" onClick={onDone} style={{ height: 52, fontSize: 17, paddingInline: 32 }}>Về trang chủ</Button>} />
    );
  }

  return (
    <Form layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={{ role: TrusteeRole.KeyHolder }} size="large">
      <Typography.Title level={3} style={{ marginTop: 0 }}>Thêm một người thân tin cậy</Typography.Title>
      <Typography.Paragraph style={{ fontSize: 16 }}>
        Chưa cần đầy đủ ngay — chỉ cần một người để bắt đầu. Họ sẽ không xem được gì cho đến khi thực sự cần.
      </Typography.Paragraph>
      <Form.Item name="displayName" label="Họ tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}><Input /></Form.Item>
      <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email chưa hợp lệ' }]}><Input /></Form.Item>
      <Form.Item name="relationship" label="Là ai với bạn?"><Input placeholder="Vợ/chồng, con, bạn thân…" /></Form.Item>
      <Form.Item name="role" label="Vai trò của họ">
        <Radio.Group>
          <Space direction="vertical" size="middle">
            {[TrusteeRole.KeyHolder, TrusteeRole.ContentOnly].map((r) => (
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
        <Button type="primary" htmlType="submit" block loading={save.isPending} style={{ height: 52, fontSize: 17 }}>Gửi lời mời</Button>
        <Button block onClick={onDone}>Để sau</Button>
      </Space>
    </Form>
  );
}
