/** Bọc ứng dụng trong theme AntD + locale tiếng Việt. */
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import type { ReactNode } from 'react';
import { createTheme } from '../theme';

export function AppProviders({ variant, children }: { variant: 'consumer' | 'admin'; children: ReactNode }) {
  return (
    <ConfigProvider theme={createTheme(variant)} locale={viVN}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
