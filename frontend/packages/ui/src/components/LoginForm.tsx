/**
 * Form đăng nhập / đăng ký kiểu REST API — nhập ngay tại đây, không chuyển trang sang backend.
 * Dùng chung cho App (owner+trustee) và Admin Console; `embedded` để nhúng vào giữa trang khác
 * (vd. trang lời mời) thay vì chiếm toàn màn hình. `googleClientId` bật thêm nút SSO Google — chỉ App
 * truyền vào ở màn đăng nhập owner; Admin Console và trang lời mời trustee không có.
 */
import { useState } from 'react';
import { Button, Card, Divider, Form, Input, Typography } from 'antd';
import type { Auth, User } from '@deathnote/api';
import { Brand } from './Brand';
import { ErrorAlert } from './ErrorAlert';
import { GoogleSignInButton } from './GoogleSignInButton';

type Values = { userName: string; email?: string; password: string; confirm?: string };

export function LoginForm({ auth, onSuccess, embedded = false, allowRegister = true, googleClientId }: {
  auth: Auth;
  onSuccess: (user: User) => void;
  embedded?: boolean;
  allowRegister?: boolean;
  /** OAuth Client ID của Google — có thì hiện nút "Tiếp tục với Google". */
  googleClientId?: string;
}) {
  const [form] = Form.useForm<Values>();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const isRegister = mode === 'register';

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setError(undefined);
    form.resetFields(['password', 'confirm']);
  };

  const onFinish = async (v: Values) => {
    setBusy(true);
    setError(undefined);
    try {
      const user = isRegister
        ? await auth.registerAccount({ userName: v.userName, email: v.email!, password: v.password })
        : await auth.loginWithPassword(v.userName, v.password);
      onSuccess(user);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const onGoogleCredential = async (idToken: string) => {
    setBusy(true);
    setError(undefined);
    try {
      onSuccess(await auth.loginWithGoogle(idToken));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <Card style={{ width: '100%', maxWidth: embedded ? undefined : 400 }}>
      {!embedded && <div style={{ textAlign: 'center', marginBottom: 16 }}><Brand size={20} /></div>}
      <Typography.Title level={4} style={{ marginTop: 0, textAlign: embedded ? 'left' : 'center' }}>
        {isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
      </Typography.Title>
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="userName" label={isRegister ? 'Tên đăng nhập' : 'Tên đăng nhập hoặc email'}
          rules={[{ required: true, message: isRegister ? 'Nhập tên đăng nhập' : 'Nhập tên đăng nhập hoặc email' }]}>
          <Input autoFocus size="large" autoComplete="username" />
        </Form.Item>
        {isRegister && (
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email chưa hợp lệ' }]}>
            <Input size="large" autoComplete="email" />
          </Form.Item>
        )}
        <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}
          extra={isRegister ? 'Ít nhất 6 ký tự, có chữ hoa, chữ thường và ký tự đặc biệt.' : undefined}>
          <Input.Password size="large" autoComplete={isRegister ? 'new-password' : 'current-password'} />
        </Form.Item>
        {isRegister && (
          <Form.Item name="confirm" label="Nhập lại mật khẩu" dependencies={['password']}
            rules={[{ required: true, message: 'Nhập lại mật khẩu' }, ({ getFieldValue }) => ({
              validator: (_, v) => (v === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('Hai lần nhập chưa khớp nhau'))),
            })]}>
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
        )}
        <ErrorAlert error={error} style={{ marginBottom: 16 }} />
        <Button type="primary" htmlType="submit" size="large" block loading={busy}>
          {isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
        </Button>
      </Form>
      {googleClientId && (
        <>
          <Divider plain style={{ margin: '16px 0' }}>hoặc</Divider>
          <GoogleSignInButton clientId={googleClientId} onCredential={onGoogleCredential} onError={setError} />
        </>
      )}
      {allowRegister && (
        <Typography.Paragraph style={{ textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
          {isRegister ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
          <Typography.Link onClick={switchMode}>{isRegister ? 'Đăng nhập' : 'Đăng ký'}</Typography.Link>
        </Typography.Paragraph>
      )}
    </Card>
  );

  if (embedded) return card;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {card}
    </div>
  );
}
