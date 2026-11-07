'use client';

/**
 * =====================================================
 * USER APPROVALS PAGE
 * =====================================================
 * Owner/CEO can approve or reject pending user signups
 * and assign roles during approval.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck,
  UserX,
  Search,
  Loader2,
  Clock,
  Shield,
  Mail,
  Phone,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ACCESS_MATRIX } from '@/domain/roles';
import { useRequireRole, useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getAllEmployees, updateEmployee, createAuditLog } from '@/services';
import { ROLE_OPTIONS } from '@/constants';
import type { UserProfile, UserRole } from '@/types';

export default function UserApprovalsPage() {
  const { isAuthorized } = useRequireRole(ACCESS_MATRIX.approvals);
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>({});

  // Fetch all users
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['all-users-approvals'],
    queryFn: getAllEmployees,
  });

  // Filter pending users
  const pendingUsers = useMemo(() => {
    return allUsers.filter(
      (u) => u.approved === false || u.status === 'pending'
    );
  }, [allUsers]);

  // Filter by search
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return pendingUsers;
    const q = searchQuery.toLowerCase();
    return pendingUsers.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone?.includes(q)
    );
  }, [pendingUsers, searchQuery]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      await updateEmployee(userId, {
        role,
        approved: true,
        status: 'active',
        isActive: true,
      } as any);

      // Audit log
      if (profile) {
        await createAuditLog({
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role!,
          action: 'user_approved',
          resource: 'users',
          resourceId: userId,
          newValue: { role, approved: true, status: 'active' },
        });
      }
    },
    onSuccess: () => {
      toast({ title: 'User Approved', description: 'The user can now access the system.' });
      queryClient.invalidateQueries({ queryKey: ['all-users-approvals'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to approve user', variant: 'destructive' });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      await updateEmployee(userId, {
        status: 'rejected',
        isActive: false,
      } as any);

      // Audit log
      if (profile) {
        await createAuditLog({
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role!,
          action: 'user_rejected',
          resource: 'users',
          resourceId: userId,
        });
      }
    },
    onSuccess: () => {
      toast({ title: 'User Rejected', description: 'The user has been rejected.' });
      queryClient.invalidateQueries({ queryKey: ['all-users-approvals'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to reject user', variant: 'destructive' });
    },
  });

  const handleApprove = (userId: string) => {
    const role = selectedRoles[userId];
    if (!role) {
      toast({ title: 'Select a Role', description: 'Please select a role before approving.', variant: 'destructive' });
      return;
    }
    approveMutation.mutate({ userId, role });
  };

  // Assignable roles (excluding owner for non-owner users)
  const assignableRoles = ROLE_OPTIONS.filter(
    (r) => profile?.role === 'owner' || r.value !== 'owner'
  );

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve pending user registrations
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
          <Clock className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">{pendingUsers.length}</span>
          <span className="text-muted-foreground">pending</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Pending Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-yellow-500" />
            Pending Users
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
              <UserCheck className="h-12 w-12" />
              <p>No pending approvals</p>
              <p className="text-sm">All user registrations have been reviewed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-4 font-medium text-muted-foreground">Name</th>
                    <th className="p-4 font-medium text-muted-foreground">Email</th>
                    <th className="p-4 font-medium text-muted-foreground">Phone</th>
                    <th className="p-4 font-medium text-muted-foreground">Created</th>
                    <th className="p-4 font-medium text-muted-foreground">Assign Role</th>
                    <th className="p-4 font-medium text-muted-foreground text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const createdDate = user.createdAt instanceof Date
                      ? user.createdAt.toLocaleDateString()
                      : 'N/A';

                    return (
                      <tr
                        key={user.uid}
                        className="border-b border-border/50 transition-colors hover:bg-muted/30"
                      >
                        {/* Name */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/20 font-medium text-yellow-500">
                              {(user.displayName || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{user.displayName || 'Unknown'}</p>
                              <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-500">
                                Pending
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            {user.email}
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {user.phone || 'N/A'}
                          </div>
                        </td>

                        {/* Created Date */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {createdDate}
                          </div>
                        </td>

                        {/* Role Selector */}
                        <td className="p-4">
                          <select
                            value={selectedRoles[user.uid] || ''}
                            onChange={(e) =>
                              setSelectedRoles((prev) => ({
                                ...prev,
                                [user.uid]: e.target.value as UserRole,
                              }))
                            }
                            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">— Select Role —</option>
                            {assignableRoles.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Actions */}
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(user.uid)}
                              disabled={approveMutation.isPending || !selectedRoles[user.uid]}
                              className="gap-1.5 bg-green-600 hover:bg-green-700"
                            >
                              {approveMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectMutation.mutate(user.uid)}
                              disabled={rejectMutation.isPending}
                              className="gap-1.5"
                            >
                              {rejectMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserX className="h-3.5 w-3.5" />
                              )}
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredUsers.length} of {pendingUsers.length} pending users
      </div>
    </div>
  );
}
