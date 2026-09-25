/** Nhận redirect từ máy chủ xác thực sau khi đăng nhập, rồi quay lại trang ban đầu. */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Result } from 'antd';
import { FullPageSpin, errorMessage } from '@deathnote/ui';
import { auth } from '../config';

export function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return; // StrictMode gọi effect 2 lần — callback chỉ xử lý được 1 lần
    handled.current = true;
    auth.handleCallback().then((returnTo) => navigate(returnTo, { replace: true })).catch(setError);
  }, [navigate]);

  if (error)
    return (
      <Result status="error" title="Đăng nhập không thành công" subTitle={errorMessage(error)}
        extra={<Button type="primary" onClick={() => auth.login('/')}>Thử lại</Button>} />
    );
  return <FullPageSpin tip="Đang hoàn tất đăng nhập…" />;
}
