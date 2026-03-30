'use client';

/**
 * =====================================================
 * EMPLOYEE DETAIL PAGE
 * =====================================================
 * View employee profile and related information.
 */

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Building2,
  CreditCard,
  Clock,
  Briefcase,
  AlertCircle,
  UserX,
  UserCheck,
  TrendingUp,
  Wallet,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getEmployee, getEmployeeAttendanceSummary, getEmployeeAdvances, getEmployeeLoans, deactivateEmployee, reactivateEmployee, deleteEmployee } from '@/services';
import { createAuditLog } from '@/services/audit-service';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/lib/date-utils';
import { formatCurrency, cn } from '@/lib/utils';
import { calculateOtRate } from '@/domain/payroll';
import { ROUTES, USER_ROLES } from '@/constants';
import type { UserRole } from '@/types';

// Role badge colors
const roleBadgeColors: Record<UserRole, string> = {
  owner: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ceo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  manager: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  supervisor: 'bg-green-500/20 text-green-400 border-green-500/30',
  draughtsman: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  bass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  helper: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthorized, profile } = useRequireRole(['owner', 'ceo', 'manager', 'supervisor']);
  const employeeId = params.id as string;
  const canManage = profile?.role === 'owner' || profile?.role === 'ceo' || profile?.role === 'manager';

  // Fetch employee data
  const { 
    data: employee, 
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => getEmployee(employeeId),
    enabled: !!employeeId,
  });

  // Fetch attendance summary
  const { data: attendanceSummary } = useQuery({
    queryKey: ['employee-attendance', employeeId],
    queryFn: () => getEmployeeAttendanceSummary(
      employeeId,
      {
        start: new Date(new Date().setDate(new Date().getDate() - 30)),
        end: new Date(),
      }
    ),
    enabled: !!employeeId,
  });

  // Fetch advances
  const { data: advances = [] } = useQuery({
    queryKey: ['employee-advances', employeeId],
    queryFn: () => getEmployeeAdvances(employeeId),
    enabled: !!employeeId,
  });

  // Fetch loans
  const { data: loans = [] } = useQuery({
    queryKey: ['employee-loans', employeeId],
    queryFn: () => getEmployeeLoans(employeeId),
    enabled: !!employeeId,
  });

  const handleToggleStatus = async () => {
    if (!employee) return;

    try {
      if (employee.isActive) {
        await deactivateEmployee(employee.uid);
        toast({
          title: 'Employee Deactivated',
          description: `${employee.displayName || 'Employee'} has been deactivated.`,
        });
      } else {
        await reactivateEmployee(employee.uid);
        toast({
          title: 'Employee Activated',
          description: `${employee.displayName || 'Employee'} has been reactivated.`,
        });
      }
      if (profile) {
        createAuditLog({
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role,
          action: 'update',
          resource: 'employees',
          resourceId: employee.uid,
          newValue: { isActive: !employee.isActive },
        });
      }
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update employee status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!employee) return;
    if (!confirm(`Are you sure you want to permanently delete ${employee.displayName || 'this employee'}? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteEmployee(employee.uid);
      if (profile) {
        createAuditLog({
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role,
          action: 'delete',
          resource: 'employees',
          resourceId: employee.uid,
          newValue: { displayName: employee.displayName, role: employee.role },
        });
      }
      toast({
        title: 'Employee Deleted',
        description: `${employee.displayName || 'Employee'} has been permanently deleted.`,
      });
      router.push(ROUTES.EMPLOYEES.LIST);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete employee',
        variant: 'destructive',
      });
    }
  };

  if (!isAuthorized) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Employee not found</p>
        <Link href={ROUTES.EMPLOYEES.LIST}>
          <Button variant="outline">Back to Employees</Button>
        </Link>
      </div>
    );
  }

  const activeLoan = loans.find(l => l.status === 'active');
  const pendingAdvances = advances.filter(a => a.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href={ROUTES.EMPLOYEES.LIST}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
              {(employee.displayName || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {employee.displayName || 'Unnamed'}
                </h1>
                <span className={cn(
                  'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  roleBadgeColors[employee.role]
                )}>
                  {USER_ROLES[employee.role]?.label || employee.role}
                </span>
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  employee.isActive 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                )}>
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    employee.isActive ? 'bg-green-400' : 'bg-red-400'
                  )} />
                  {employee.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-muted-foreground">
                {employee.workerId || 'No Employee ID'}
              </p>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleToggleStatus}
            >
              {employee.isActive ? (
                <>
                  <UserX className="h-4 w-4 text-red-400" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 text-green-400" />
                  Activate
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-red-500 hover:bg-red-500/10"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Link href={ROUTES.EMPLOYEES.EDIT(employeeId)}>
              <Button className="gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <DollarSign className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Daily Rate</p>
                <p className="text-xl font-bold">
                  {formatCurrency(employee.dailyRate || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/20 p-2">
                <Clock className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days (30d)</p>
                <p className="text-xl font-bold">
                  {attendanceSummary?.totalDays || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/20 p-2">
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">OT Hours (30d)</p>
                <p className="text-xl font-bold">
                  {attendanceSummary?.overtimeHours?.toFixed(1) || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/20 p-2">
                <Wallet className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Loan</p>
                <p className="text-xl font-bold">
                  {activeLoan ? formatCurrency(activeLoan.remainingAmount) : 'None'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal Information */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{employee.email}</p>
              </div>
            </div>
            {employee.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{employee.phone}</p>
                </div>
              </div>
            )}
            {employee.address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{employee.address}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Join Date</p>
                <p className="font-medium">
                  {formatDate(employee.joiningDate || employee.createdAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Salary Information */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle>Salary Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Daily Rate</p>
                <p className="font-medium">
                  {formatCurrency(employee.dailyRate || 0)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">OT Rate (Auto-calculated)</p>
                <p className="font-medium">
                  {formatCurrency(calculateOtRate(employee.dailyRate || 0))} / hour
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Role Level</p>
                <p className="font-medium">
                  Level {USER_ROLES[employee.role]?.level || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Bank Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employee.bankDetails?.bankName ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Bank</p>
                    <p className="font-medium">{employee.bankDetails.bankName}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Account Number</p>
                  <p className="font-medium font-mono">
                    {employee.bankDetails.accountNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Account Holder</p>
                  <p className="font-medium">
                    {employee.bankDetails.accountHolderName}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No bank details provided</p>
            )}
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employee.emergencyContact ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Contact Name</p>
                  <p className="font-medium">{employee.emergencyContact}</p>
                </div>
                {employee.emergencyPhone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{employee.emergencyPhone}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No emergency contact provided</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Loan */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Active Loan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeLoan ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Principal</p>
                    <p className="font-medium">{formatCurrency(activeLoan.principalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Remaining</p>
                    <p className="font-medium text-orange-400">
                      {formatCurrency(activeLoan.remainingAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">EMI Amount</p>
                    <p className="font-medium">{formatCurrency(activeLoan.emiAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="font-medium">
                      {activeLoan.paidEmis} / {activeLoan.totalEmis} EMIs
                    </p>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ 
                      width: `${(activeLoan.paidEmis / activeLoan.totalEmis) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No active loan</p>
            )}
          </CardContent>
        </Card>

        {/* Pending Advances */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Pending Advances
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingAdvances.length > 0 ? (
              <div className="space-y-3">
                {pendingAdvances.map((advance) => (
                  <div 
                    key={advance.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                  >
                    <div>
                      <p className="font-medium">{formatCurrency(advance.amount)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(advance.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No pending advances</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
