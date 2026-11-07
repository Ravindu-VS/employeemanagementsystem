import { Suspense } from 'react';
import EditEmployeePage from './edit-employee';

// Static-export friendly route: the record id comes from ?id=… so every
// record works on GitHub Pages (no per-id pre-rendering needed).
export default function Page() {
  return (
    <Suspense fallback={null}>
      <EditEmployeePage />
    </Suspense>
  );
}
