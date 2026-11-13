import { cn } from '@/lib/utils';
import { USER_ROLES } from '@/constants';
import type { UserRole } from '@/types';

/** Theme-safe role badge (readable in light and dark mode). */
export const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  owner: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  ceo: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  manager: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  supervisor: 'bg-green-500/15 text-green-700 dark:text-green-300',
  draughtsman: 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-300',
  bass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  helper: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  driver: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
};

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', ROLE_BADGE_CLASSES[role] || ROLE_BADGE_CLASSES.helper, className)}>
      {USER_ROLES[role]?.label || role}
    </span>
  );
}
