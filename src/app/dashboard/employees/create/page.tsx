'use client';

/**
 * =====================================================
 * CREATE EMPLOYEE PAGE
 * =====================================================
 * Form to add a new employee to the system.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
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
  FileText,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createEmployee, generateWorkerId } from '@/services';
import { createAuditLog } from '@/services/audit-service';
import { createUserWithEmailAndPassword, updateProfile, signOut as firebaseSignOut } from 'firebase/auth';
import { secondaryAuth } from '@/lib/firebase/config';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { ROUTES, USER_ROLES } from '@/constants';
import type { UserRole } from '@/types';

// Form validation schema
const employeeSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['owner', 'ceo', 'manager', 'supervisor', 'draughtsman', 'bass', 'helper']),
  phone: z.string().optional(),
  address: z.string().optional(),
  employeeId: z.string().optional(),
  dailyRate: z.number().min(0, 'Daily rate must be positive'),
  otRate: z.number().min(0, 'OT rate must be positive').optional(),
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

export default function CreateEmployeePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthorized, profile } = useRequireRole(['owner', 'ceo', 'manager']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      role: 'helper',
      dailyRate: 0,
      otRate: 0,
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: EmployeeFormData) => {
    setIsSubmitting(true);
    try {
      // Auto-generate worker ID
      const workerId = await generateWorkerId();

      // Create Firebase Auth user using SECONDARY auth instance
      // This prevents switching the current user's session
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        data.email,
        data.password
      );
      const firebaseUser = userCredential.user;

      // Update display name on the new user
      await updateProfile(firebaseUser, { displayName: data.displayName });

      // Sign out the secondary auth immediately so it doesn't persist
      await firebaseSignOut(secondaryAuth);

      // Create employee profile in Firestore
      await createEmployee(firebaseUser.uid, {
        email: data.email,
        displayName: data.displayName,
        photoURL: null,
        role: data.role as UserRole,
        isActive: true,
        workerId,
        phone: data.phone || '',
        address: data.address,
        dailyRate: data.dailyRate,
        otRate: data.otRate || data.dailyRate * 1.5,
        hourlyRate: 0,
        weeklyRate: 0,
        joiningDate: data.joinDate ? new Date(data.joinDate) : new Date(),
        assignedSites: [],
        emergencyContact: data.emergencyContact?.name,
        emergencyPhone: data.emergencyContact?.phone,
        bankDetails: data.bankDetails ? {
          bankName: data.bankDetails.bankName || '',
          accountNumber: data.bankDetails.accountNumber || '',
          accountHolderName: data.bankDetails.accountHolderName || '',
        } : undefined,
        documents: [],
        metadata: { loginCount: 0 },
      } as any);

      // Invalidate employees query so the list refreshes
      await queryClient.invalidateQueries({ queryKey: ['employees'] });

      if (profile) {
        createAuditLog({
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role,
          action: 'create',
          resource: 'employees',
          resourceId: firebaseUser.uid,
          newValue: { displayName: data.displayName, role: data.role, workerId },
        });
      }

      toast({
        title: 'Employee Created',
        description: `${data.displayName} (${workerId}) has been added successfully.`,
      });

      router.push(ROUTES.EMPLOYEES.LIST);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create employee',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={ROUTES.EMPLOYEES.LIST}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Employee</h1>
          <p className="text-muted-foreground">
            Fill in the details to create a new employee account
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
                Employee personal and account details
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
                    placeholder="Auto-generated (WRK001)"
                    disabled
                    value="Auto-generated"
                  />
                  <p className="text-xs text-muted-foreground">
                    Will be auto-assigned on creation
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email" required>Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    icon={<Mail className="h-4 w-4" />}
                    {...register('email')}
                    error={errors.email?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" required>Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...register('password')}
                    error={errors.password?.message}
                  />
                </div>
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
                  <Label htmlFor="otRate">OT Rate (LKR)</Label>
                  <Input
                    id="otRate"
                    type="number"
                    placeholder="Auto: 1.5x daily rate"
                    icon={<DollarSign className="h-4 w-4" />}
                    {...register('otRate', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for 1.5x daily rate
                  </p>
                </div>
              </div>
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
                For salary disbursement (optional)
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
                Contact in case of emergency (optional)
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
          <Link href={ROUTES.EMPLOYEES.LIST}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Create Employee
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
