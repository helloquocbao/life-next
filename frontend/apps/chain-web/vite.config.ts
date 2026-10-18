import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// LifeNext on Solana — web tĩnh, không backend. Cổng 5190 (khớp CORS của IPFS dev trong chain/scripts/ipfs-cors.sh).
export default defineConfig({
  plugins: [react()],
  server: { port: 5190, strictPort: true },
  define: { 'process.env': {} },
  optimizeDeps: { include: ['libsodium-wrappers-sumo', 'buffer'] },
});
