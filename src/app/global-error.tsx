'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/services/maintenance-service';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { void reportClientError(error, { source: 'global' }); }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, background: '#111', color: '#f5f5f5' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h2 style={{ fontSize: 18 }}>KK &amp; SONS — the app hit an error</h2>
          <p style={{ fontSize: 14, opacity: 0.8 }}>It was recorded for the administrator. Your saved data is safe.</p>
          <button onClick={reset} style={{ marginTop: 12, height: 40, padding: '0 16px', borderRadius: 6, border: 0, background: '#E53935', color: '#fff', fontWeight: 600 }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
