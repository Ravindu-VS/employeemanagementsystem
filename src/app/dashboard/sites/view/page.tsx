import { Suspense } from 'react';
import SiteDetailPage from './site-detail';

// Static-export friendly route: the record id comes from ?id=… so every
// record works on GitHub Pages (no per-id pre-rendering needed).
export default function Page() {
  return (
    <Suspense fallback={null}>
      <SiteDetailPage />
    </Suspense>
  );
}
