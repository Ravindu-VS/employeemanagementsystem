/**
 * Small shared building blocks for dashboard pages (forms, empty states, pills).
 */
import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
/** For selects that sit inline in a toolbar (no full width). */
export const selectInlineCls = 'flex h-10 rounded-md border border-input bg-background px-3 text-sm';
export const textareaCls = 'flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-1', className)}><Label>{label}</Label>{children}</div>;
}

export function FormActions({ onCancel, pending, label = 'Save', className = 'sm:col-span-3' }: { onCancel?: () => void; pending: boolean; label?: string; className?: string }) {
  return (
    <div className={cn('flex justify-end gap-2', className)}>
      {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
      <Button type="submit" disabled={pending} className="gap-2">{pending && <Loader2 className="h-4 w-4 animate-spin" />} {label}</Button>
    </div>
  );
}

export function Spinner() {
  return <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="flex h-24 items-center justify-center text-center text-sm text-muted-foreground">{text}</div>;
}

const TONES = {
  green: 'bg-green-500/15 text-green-700 dark:text-green-300',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300',
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  slate: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
} as const;
export type Tone = keyof typeof TONES;

export function Pill({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize', TONES[tone])}>{children}</span>;
}

/**
 * Chart colours resolved from CSS variables (SVG presentation attributes
 * cannot use var()). Re-reads when the light/dark theme changes.
 */
export function useVizColors() {
  const [c, setC] = React.useState({ series: '#2a78d6', grid: '#e4e4e1', axis: '#6b6a66', surface: '#ffffff' });
  React.useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
      const card = cs.getPropertyValue('--card').trim();
      setC({ series: v('--viz-1', '#2a78d6'), grid: v('--viz-grid', '#e4e4e1'), axis: v('--viz-axis', '#6b6a66'), surface: card ? `hsl(${card})` : '#ffffff' });
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => mo.disconnect();
  }, []);
  return c;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
