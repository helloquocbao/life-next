/**
 * HTTP client có kiểm tra kiểu cho toàn bộ API (openapi-fetch + schema sinh tự động).
 *
 * Ví dụ:
 *   const status = await unwrap(api.GET('/api/app/owner/status'));
 *   // status có kiểu OwnerStatusDto — sai tên trường là lỗi biên dịch.
 */
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

/** Lỗi nghiệp vụ trả về từ ABP: { error: { code, message, details, validationErrors } }. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: string,
    public readonly validationErrors?: { message: string; members: string[] }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(baseUrl: string, getAccessToken: () => Promise<string | null>, onUnauthorized?: () => void) {
  const client = createClient<paths>({ baseUrl });

  const middleware: Middleware = {
    async onRequest({ request }) {
      const token = await getAccessToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      request.headers.set('Accept-Language', 'vi');
      return request;
    },
    async onResponse({ response }) {
      if (response.status === 401) onUnauthorized?.();
      return response;
    },
  };
  client.use(middleware);
  return client;
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/** Trả về `data` hoặc ném ApiError với thông báo tiếng Việt từ server. */
export async function unwrap<T>(promise: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await promise;
  if (response.ok) return data as T;
  const e = (error as { error?: { message?: string; code?: string; details?: string; validationErrors?: [] } } | undefined)?.error;
  const fallback =
    response.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.' :
    response.status === 404 ? 'Không tìm thấy dữ liệu.' :
    response.status === 401 ? 'Phiên đăng nhập đã hết hạn.' :
    'Có lỗi xảy ra, vui lòng thử lại.';
  throw new ApiError(e?.message || fallback, response.status, e?.code, e?.details, e?.validationErrors);
}

/** Tải file nhị phân kèm token (vd. tệp bằng chứng cho admin). */
export async function downloadBlob(baseUrl: string, path: string, token: string | null): Promise<Blob> {
  const res = await fetch(baseUrl + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError('Không tải được tệp.', res.status);
  return res.blob();
}
