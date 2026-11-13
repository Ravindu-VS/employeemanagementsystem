'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { reportClientError } from '@/services/maintenance-service';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { void reportClientError(error, { source: 'page' }); }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <div>
        <h2 className="text-lg font-semibold text-foreground">Something went wrong on this page</h2>
        <p className="text-sm text-muted-foreground">The error was recorded for the administrator. Your saved data is safe.</p>
      </div>
      <button onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <RotateCcw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
