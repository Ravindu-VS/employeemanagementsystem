'use client';

/**
 * =====================================================
 * EMPLOYEE CARD
 * =====================================================
 * Mobile-friendly card view for displaying employee details
 * Used on smaller screens instead of table view
 */

import Link from 'next/link';
import {
  Eye,
  Edit,
  Trash2,
  UserX,
  UserCheck,
  Mail,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { USER_ROLES, ROUTES } from '@/constants';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import type { UserProfile, UserRole } from '@/types';

const roleBadgeColors: Record<UserRole, string> = {
  owner: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ceo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  manager: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  supervisor: 'bg-green-500/20 text-green-400 border-green-500/30',
  draughtsman: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  bass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  helper: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

interface EmployeeCardProps {
  employee: UserProfile;
  canManage: boolean;
  onToggleStatus: (employee: UserProfile) => void;
  onDelete: (employee: UserProfile) => void;
  isDeleting: boolean;
}

export function EmployeeCard({
  employee,
  canManage,
  onToggleStatus,
  onDelete,
  isDeleting,
}: EmployeeCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header: Name, Avatar, Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
              {(employee.displayName || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm leading-tight">{employee.displayName || 'Unnamed'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {employee.workerId || 'No ID'}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                employee.isActive
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  employee.isActive ? 'bg-green-400' : 'bg-red-400'
                )}
              />
              {employee.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Role Badge */}
        <div>
          <span
            className={cn(
              'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
              roleBadgeColors[employee.role]
            )}
          >
            {USER_ROLES[employee.role]?.label || employee.role}
          </span>
        </div>

        {/* Contact Information */}
        <div className="space-y-2 border-t border-border/50 pt-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground">{employee.email}</span>
          </div>
          {employee.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">{employee.phone}</span>
            </div>
          )}
        </div>

        {/* Daily Rate and Joined Date */}
        <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Daily Rate</p>
            <p className="font-semibold">LKR {employee.dailyRate?.toLocaleString() || '0'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Joined</p>
            <p className="font-semibold text-xs">
              {formatDate(employee.joiningDate || employee.createdAt)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
          <Link href={ROUTES.EMPLOYEES.DETAIL(employee.uid)} className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-9">
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
          </Link>

          {canManage && (
            <>
              <Link href={ROUTES.EMPLOYEES.EDIT(employee.uid)} className="flex-1">
                <Button variant="outline" size="sm" className="w-full h-9">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>

              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => onToggleStatus(employee)}
                title={employee.isActive ? 'Deactivate' : 'Activate'}
              >
                {employee.isActive ? (
                  <UserX className="h-4 w-4 text-red-400" />
                ) : (
                  <UserCheck className="h-4 w-4 text-green-400" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => onDelete(employee)}
                disabled={isDeleting}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
