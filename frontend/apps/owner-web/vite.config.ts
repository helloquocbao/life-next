import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev server cho "Death Note" — cổng 5173 (khớp cấu hình OIDC client ở backend).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  optimizeDeps: { include: ['libsodium-wrappers-sumo'] },
});
