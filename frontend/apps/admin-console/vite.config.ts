import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev server cho "Death Note — Admin" — cổng 5175 (khớp cấu hình OIDC client ở backend).
export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true },
  optimizeDeps: { include: ['libsodium-wrappers-sumo'] },
});
