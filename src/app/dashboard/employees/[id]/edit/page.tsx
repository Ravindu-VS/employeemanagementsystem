'use client';

/**
 * =====================================================
 * EDIT EMPLOYEE PAGE
 * =====================================================
 * Form to update an existing employee's information.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getEmployee, updateEmployee } from '@/services';
import { createAuditLog } from '@/services/audit-service';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { ROUTES, USER_ROLES } from '@/constants';
import { calculateOtRate } from '@/domain/payroll';
import { formatCurrency } from '@/lib/utils';
import type { UserRole } from '@/types';

// Form validation schema
const employeeSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['owner', 'ceo', 'manager', 'supervisor', 'draughtsman', 'bass', 'helper']),
  phone: z.string().optional(),
  address: z.string().optional(),
  employeeId: z.string().optional(),
  dailyRate: z.number().min(0, 'Daily rate must be positive'),
  joinDate: z.string().optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    relationship: z.string().optional(),
  }).optional(),
  bankDetails: z.object({
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    accountHolderName: z.string().optional(),
  }).optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthorized, profile } = useRequireRole(['owner', 'ceo', 'manager']);
  const employeeId = params.id as string;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch employee data
  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => getEmployee(employeeId),
    enabled: !!employeeId,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      role: 'helper',
      dailyRate: 0,
    },
  });

  const selectedRole = watch('role');
  const dailyRate = watch('dailyRate');
  const calculatedOtRate = calculateOtRate(dailyRate || 0);

  // Populate form with employee data
  useEffect(() => {
    if (employee) {
      reset({
        displayName: employee.displayName || '',
        role: employee.role,
        phone: employee.phone || '',
        address: employee.address || '',
        employeeId: employee.workerId || '',
        dailyRate: employee.dailyRate || 0,
        joinDate: employee.joiningDate
          ? new Date(employee.joiningDate).toISOString().split('T')[0]
          : '',
        emergencyContact: {
          name: employee.emergencyContact || '',
          phone: employee.emergencyPhone || '',
          relationship: '',
        },
        bankDetails: {
          bankName: employee.bankDetails?.bankName || '',
          accountNumber: employee.bankDetails?.accountNumber || '',
          accountHolderName: employee.bankDetails?.accountHolderName || '',
        },
      });
    }
  }, [employee, reset]);

  const onSubmit = async (data: EmployeeFormData) => {
    setIsSubmitting(true);
    try {
      const updateData: Record<string, unknown> = {
        displayName: data.displayName,
        role: data.role as UserRole,
        phone: data.phone,
        address: data.address,
        workerId: data.employeeId,
        dailyRate: data.dailyRate,
        joiningDate: data.joinDate ? new Date(data.joinDate) : employee?.joiningDate,
        emergencyContact: data.emergencyContact?.name,
        emergencyPhone: data.emergencyContact?.phone,
        bankDetails: data.bankDetails,
      };

      await updateEmployee(employeeId, updateData as any);

      if (profile) {
        createAuditLog({
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role,
          action: 'update',
          resource: 'employees',
          resourceId: employeeId,
          newValue: { displayName: data.displayName, role: data.role },
        });
      }

      toast({
        title: 'Employee Updated',
        description: `${data.displayName} has been updated successfully.`,
      });

      router.push(ROUTES.EMPLOYEES.DETAIL(employeeId));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update employee',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={ROUTES.EMPLOYEES.DETAIL(employeeId)}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Employee</h1>
          <p className="text-muted-foreground">
            Update information for {employee.displayName}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Information */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Employee personal details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayName" required>Full Name</Label>
                  <Input
                    id="displayName"
                    placeholder="John Doe"
                    {...register('displayName')}
                    error={errors.displayName?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input
                    id="employeeId"
                    placeholder="EMP001"
                    {...register('employeeId')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  value={employee.email}
                  disabled
                  className="bg-muted/50"
                  icon={<Mail className="h-4 w-4" />}
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="+94 77 123 4567"
                    icon={<Phone className="h-4 w-4" />}
                    {...register('phone')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" required>Role</Label>
                  <select
                    id="role"
                    {...register('role')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {Object.entries(USER_ROLES).map(([key, role]) => (
                      <option key={key} value={key}>{role.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Level {USER_ROLES[selectedRole as UserRole]?.level}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street, City"
                  icon={<MapPin className="h-4 w-4" />}
                  {...register('address')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinDate">Join Date</Label>
                <Input
                  id="joinDate"
                  type="date"
                  icon={<Calendar className="h-4 w-4" />}
                  {...register('joinDate')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Salary Information */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Salary Information
              </CardTitle>
              <CardDescription>
                Daily rate and overtime settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dailyRate" required>Daily Rate (LKR)</Label>
                  <Input
                    id="dailyRate"
                    type="number"
                    placeholder="2500"
                    icon={<DollarSign className="h-4 w-4" />}
                    {...register('dailyRate', { valueAsNumber: true })}
                    error={errors.dailyRate?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Label>OT Rate (Auto-calculated)</Label>
                  <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm h-10 flex items-center">
                    <p className="font-medium text-foreground">
                      {formatCurrency(calculatedOtRate)} / hour
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                OT rate is calculated as: Daily Rate ÷ 8 hours
              </p>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Bank Details
              </CardTitle>
              <CardDescription>
                For salary disbursement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  placeholder="Commercial Bank"
                  icon={<Building2 className="h-4 w-4" />}
                  {...register('bankDetails.bankName')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  placeholder="1234567890"
                  {...register('bankDetails.accountNumber')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountHolderName">Account Holder Name</Label>
                <Input
                  id="accountHolderName"
                  placeholder="John Doe"
                  {...register('bankDetails.accountHolderName')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Emergency Contact
              </CardTitle>
              <CardDescription>
                Contact in case of emergency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyName">Contact Name</Label>
                <Input
                  id="emergencyName"
                  placeholder="Jane Doe"
                  icon={<User className="h-4 w-4" />}
                  {...register('emergencyContact.name')}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Phone Number</Label>
                  <Input
                    id="emergencyPhone"
                    placeholder="+94 77 765 4321"
                    icon={<Phone className="h-4 w-4" />}
                    {...register('emergencyContact.phone')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyRelationship">Relationship</Label>
                  <Input
                    id="emergencyRelationship"
                    placeholder="Spouse, Parent, etc."
                    {...register('emergencyContact.relationship')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Link href={ROUTES.EMPLOYEES.DETAIL(employeeId)}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
