/**
 * Nút "Đăng nhập bằng Google" — Google Identity Services (GIS), không chuyển trang.
 * GIS trả về ID token ("credential") ngay trong trang; gửi nó cho `onCredential` để đổi lấy token backend.
 * Origin của SPA phải nằm trong "Authorized JavaScript origins" của OAuth Client ID trên Google Cloud.
 */
import { useEffect, useRef, useState } from 'react';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

type Gis = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup' }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

let gisPromise: Promise<Gis> | undefined;

function loadGis(): Promise<Gis> {
  gisPromise ??= new Promise<Gis>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve((window as unknown as { google: Gis }).google);
    script.onerror = () => {
      gisPromise = undefined;
      reject(new Error('Không tải được dịch vụ đăng nhập Google.'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

export function GoogleSignInButton({ clientId, onCredential, onError }: {
  clientId: string;
  onCredential: (idToken: string) => void;
  onError?: (e: unknown) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Giữ callback mới nhất mà không phải khởi tạo lại GIS mỗi lần render.
  const handler = useRef(onCredential);
  handler.current = onCredential;
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  useEffect(() => {
    if (ref.current) setWidth(Math.min(400, Math.floor(ref.current.offsetWidth)));
  }, []);

  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    loadGis()
      .then((google) => {
        if (cancelled || !ref.current) return;
        google.accounts.id.initialize({ client_id: clientId, ux_mode: 'popup', callback: (r) => handler.current(r.credential) });
        google.accounts.id.renderButton(ref.current, {
          type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular',
          logo_alignment: 'center', locale: 'vi', width,
        });
      })
      .catch((e) => !cancelled && errorHandler.current?.(e));
    return () => { cancelled = true; };
  }, [clientId, width]);

  return <div ref={ref} style={{ width: '100%', minHeight: 40, display: 'flex', justifyContent: 'center' }} />;
}
