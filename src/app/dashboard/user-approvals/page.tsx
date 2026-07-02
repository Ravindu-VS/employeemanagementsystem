'use client';

import * as React from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth, useRequireRole } from '@/components/providers/auth-provider';
import { createAuditLog } from '@/services/audit-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { COLLECTIONS, ROLE_OPTIONS } from '@/constants';
import { 
  UserCheck, 
  UserX, 
  Loader2, 
  ShieldCheck, 
  Clock,
  Users,
  RefreshCw,
} from 'lucide-react';
import type { UserRole } from '@/types';

interface PendingUser {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  createdAt: Date;
  status: string;
  approved: boolean;
}

export default function UserApprovalsPage() {
  const { hasAccess, isLoading: authLoading } = useRequireRole(['owner', 'ceo']);
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [pendingUsers, setPendingUsers] = React.useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedRoles, setSelectedRoles] = React.useState<Record<string, string>>({});
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  // Fetch pending users
  const fetchPendingUsers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, COLLECTIONS.USERS),
        where('approved', '==', false),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      const users: PendingUser[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          displayName: data.displayName || 'Unknown',
          email: data.email || '',
          phone: data.phone || '',
          createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
          status: data.status || 'pending',
          approved: data.approved || false,
        };
      });
      setPendingUsers(users.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return aTime - bTime;
      }));
    } catch (error) {
      console.error('Error fetching pending users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending users.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (hasAccess) {
      fetchPendingUsers();
    }
  }, [hasAccess, fetchPendingUsers]);

  // Approve user
  const handleApprove = async (user: PendingUser) => {
    const role = selectedRoles[user.uid];
    if (!role) {
      toast({
        title: 'Select a Role',
        description: 'Please select a role before approving.',
        variant: 'destructive',
      });
      return;
    }

    setProcessingId(user.uid);
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
        approved: true,
        status: 'active',
        isActive: true,
        role: role,
        payType: role === 'driver' ? 'daily_based' : 'site_based',
        updatedAt: new Date(),
      });

      // Audit log
      if (profile) {
        await createAuditLog({
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role as UserRole,
          action: 'user_approved',
          resource: 'users',
          resourceId: user.uid,
          newValue: { role, approved: true, status: 'active' },
        });
      }

      toast({
        title: 'User Approved',
        description: `${user.displayName} has been approved as ${role}.`,
      });

      // Remove from list
      setPendingUsers(prev => prev.filter(u => u.uid !== user.uid));
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve user.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Reject user
  const handleReject = async (user: PendingUser) => {
    setProcessingId(user.uid);
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
        status: 'rejected',
        isActive: false,
        updatedAt: new Date(),
      });

      // Audit log
      if (profile) {
        await createAuditLog({
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role as UserRole,
          action: 'user_rejected',
          resource: 'users',
          resourceId: user.uid,
        });
      }

      toast({
        title: 'User Rejected',
        description: `${user.displayName}'s account has been rejected.`,
      });

      setPendingUsers(prev => prev.filter(u => u.uid !== user.uid));
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject user.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
      </div>
    );
  }

  // Available roles for assignment (exclude owner — only the first user can be owner)
  const assignableRoles = ROLE_OPTIONS.filter(r => r.value !== 'owner');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            User Approvals
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve pending user registrations
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchPendingUsers}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Pending count */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingUsers.length}</p>
              <p className="text-sm text-muted-foreground">Pending Approvals</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Users Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No pending user approvals</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <Card key={user.uid} className="overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* User info */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="font-medium">{user.displayName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm">{user.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm">
                        {user.createdAt instanceof Date
                          ? user.createdAt.toLocaleDateString()
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Role selector */}
                    <select
                      value={selectedRoles[user.uid] || ''}
                      onChange={(e) => setSelectedRoles(prev => ({ ...prev, [user.uid]: e.target.value }))}
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={processingId === user.uid}
                    >
                      <option value="">Select Role...</option>
                      {assignableRoles.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>

                    {/* Approve */}
                    <Button
                      size="sm"
                      onClick={() => handleApprove(user)}
                      disabled={processingId === user.uid || !selectedRoles[user.uid]}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processingId === user.uid ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>

                    {/* Reject */}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(user)}
                      disabled={processingId === user.uid}
                    >
                      <UserX className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
