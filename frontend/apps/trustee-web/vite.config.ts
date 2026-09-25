import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev server cho "Death Note — Người được uỷ quyền" — cổng 5174 (khớp cấu hình OIDC client ở backend).
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  optimizeDeps: { include: ['libsodium-wrappers-sumo'] },
});
