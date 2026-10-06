/**
 * Kiểu phụ cho Admin Console, suy ra trực tiếp từ OpenAPI (không tự định nghĩa lại DTO).
 * Nhờ vậy khi backend đổi hợp đồng API, `pnpm gen:api` + typecheck sẽ báo lỗi ngay tại đây.
 */
import type { components } from '@deathnote/api';

type S = components['schemas'];

export type StateCountDto = S['Admin.StateCountDto'];
