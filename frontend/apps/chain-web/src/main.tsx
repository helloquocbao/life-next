import './polyfills';
import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { AppProviders } from '@deathnote/ui';
import { config } from './config';
import { SessionProvider } from './lib/session';
import { DevWalletAdapter } from './lib/devWallet';
import { App } from './App';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function Root() {
  // Ví thử (khoá lưu trong trình duyệt) chỉ có trên localnet. Phantom/Solflare… tự nhận qua Wallet Standard.
  const wallets = useMemo(() => (config.cluster === 'localnet' ? [new DevWalletAdapter()] : []), []);
  return (
    <ConnectionProvider endpoint={config.rpcUrl} config={{ commitment: 'confirmed' }}>
      <WalletProvider wallets={wallets} autoConnect>
        <SessionProvider>
          <QueryClientProvider client={queryClient}>
            <AppProviders variant="consumer">
              <App />
            </AppProviders>
          </QueryClientProvider>
        </SessionProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
