import { Alert } from 'antd';
import { ApiError } from '@deathnote/api';

/** Hiển thị lỗi (ApiError từ server, CryptoError, hoặc lỗi bất kỳ) bằng thông báo thân thiện. */
export function ErrorAlert({ error, style }: { error: unknown; style?: React.CSSProperties }) {
  if (!error) return null;
  return <Alert type="error" showIcon title={errorMessage(error)} style={style} />;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Có lỗi xảy ra.';
}
