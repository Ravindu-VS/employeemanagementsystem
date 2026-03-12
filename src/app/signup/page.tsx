'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ROUTES, COLLECTIONS, ROLE_OPTIONS } from '@/constants';
import { Building2, Mail, Lock, User, Phone, Loader2, ArrowLeft, ShieldCheck, Briefcase, MapPin, CreditCard, Users } from 'lucide-react';

// Role icons mapping
const roleIcons: Record<string, React.ReactNode> = {
  owner: <ShieldCheck className="h-5 w-5" />,
  ceo: <Briefcase className="h-5 w-5" />,
  manager: <Users className="h-5 w-5" />,
  supervisor: <MapPin className="h-5 w-5" />,
  draughtsman: <Briefcase className="h-5 w-5" />,
  bass: <Users className="h-5 w-5" />,
  helper: <Users className="h-5 w-5" />,
};

// Role descriptions
const roleDescriptions: Record<string, string> = {
  owner: 'Full system access and control',
  ceo: 'Executive access to all features',
  manager: 'Manage employees, sites, and payroll',
  supervisor: 'Supervise sites and track attendance',
  draughtsman: 'Technical drawing and design work',
  bass: 'Team lead for construction work',
  helper: 'General construction assistance',
};

// Validation schema
const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  role: z.enum(['owner', 'ceo', 'manager', 'supervisor', 'draughtsman', 'bass', 'helper'] as const),
  nic: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState<boolean | null>(null);
  const [step, setStep] = useState(1); // Multi-step form

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'helper',
      nic: '',
      address: '',
      emergencyContact: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Check if this is the first user (will be owner)
  useEffect(() => {
    const checkFirstUser = async () => {
      try {
        const usersQuery = query(collection(db, COLLECTIONS.USERS), limit(1));
        const snapshot = await getDocs(usersQuery);
        setIsFirstUser(snapshot.empty);
        // If first user, set role to owner
        if (snapshot.empty) {
          form.setValue('role', 'owner');
        }
      } catch (error) {
        console.error('Error checking users:', error);
        setIsFirstUser(false);
      }
    };
    checkFirstUser();
  }, [form]);

  // Handle Google Sign-Up
  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    
    try {
      const { profile, isNewUser } = await signInWithGoogle();
      
      if (isNewUser) {
        if (profile.isActive) {
          toast({
            title: "Welcome!",
            description: "Your account has been created. You are the system owner.",
          });
          router.push(ROUTES.DASHBOARD);
        } else {
          toast({
            title: "Account Created",
            description: "Your account is pending approval. Please wait for admin confirmation.",
          });
          router.push(ROUTES.LOGIN);
        }
      } else {
        // Existing user - just redirect
        if (profile.isActive) {
          toast({
            title: "Welcome back!",
            description: `Logged in as ${profile.displayName || profile.email}`,
          });
          router.push(ROUTES.DASHBOARD);
        } else {
          toast({
            title: "Account Pending",
            description: "Your account is pending approval.",
            variant: "destructive",
          });
        }
      }
      
    } catch (error: any) {
      toast({
        title: "Google Sign-Up Failed",
        description: error.message || "Failed to sign up with Google.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    
    try {
      // Create Firebase auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      
      const user = userCredential.user;

      // Update profile with display name
      await updateProfile(user, {
        displayName: data.name,
      });

      // Determine role - first user is always owner
      const finalRole = isFirstUser ? 'owner' : data.role;
      
      // Determine status - admin roles are active, field workers need approval
      const needsApproval = ['draughtsman', 'bass', 'helper'].includes(data.role);
      const isActive = isFirstUser || !needsApproval;

      // Create user document in Firestore
      await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
        uid: user.uid,
        email: data.email,
        displayName: data.name,
        photoURL: null,
        phone: data.phone,
        role: finalRole,
        nic: data.nic || null,
        address: data.address || null,
        emergencyContact: data.emergencyContact || null,
        isActive: isActive,
        joiningDate: new Date(),
        assignedSites: [],
        hourlyRate: 0,
        weeklyRate: 0,
        documents: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          loginCount: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      toast({
        title: 'Account Created!',
        description: isFirstUser 
          ? 'Welcome! You are now the owner of this system.'
          : needsApproval 
            ? 'Your account is pending approval. Please wait for admin confirmation.'
            : 'Your account has been created. You can now sign in.',
      });

      // Redirect to login
      router.push(ROUTES.LOGIN);
      
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let errorMessage = 'Failed to create account';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary rounded-xl">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">EMS Admin</h1>
              <p className="text-sm text-muted-foreground">Employee Management System</p>
            </div>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">
              {isFirstUser === true ? (
                <span className="flex items-center justify-center gap-2 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  You will be the system owner
                </span>
              ) : (
                `Step ${step} of 2 - ${step === 1 ? 'Basic Information' : 'Role & Password'}`
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign-Up Button */}
            <div className="mb-6">
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white hover:bg-gray-100 text-gray-900 border-gray-300"
                size="lg"
                onClick={handleGoogleSignUp}
                disabled={isLoading || isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                      <path fill="none" d="M1 1h22v22H1z" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>
              
              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {step === 1 && (
                <>
                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder="John Doe"
                        className="pl-9"
                        disabled={isLoading}
                        {...form.register('name')}
                      />
                    </div>
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        className="pl-9"
                        disabled={isLoading}
                        {...form.register('email')}
                      />
                    </div>
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        placeholder="+94 77 123 4567"
                        className="pl-9"
                        disabled={isLoading}
                        {...form.register('phone')}
                      />
                    </div>
                    {form.formState.errors.phone && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.phone.message}
                      </p>
                    )}
                  </div>

                  {/* NIC */}
                  <div className="space-y-2">
                    <Label htmlFor="nic">NIC Number (Optional)</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="nic"
                        placeholder="123456789V"
                        className="pl-9"
                        disabled={isLoading}
                        {...form.register('nic')}
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="address">Address (Optional)</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <textarea
                        id="address"
                        placeholder="Your address"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLoading}
                        {...form.register('address')}
                      />
                    </div>
                  </div>

                  {/* Next Button */}
                  <Button 
                    type="button" 
                    className="w-full" 
                    onClick={async () => {
                      const isValid = await form.trigger(['name', 'email', 'phone']);
                      if (isValid) setStep(2);
                    }}
                  >
                    Next Step
                  </Button>
                </>
              )}

              {step === 2 && (
                <>
                  {/* Role Selection - Only show if not first user */}
                  {!isFirstUser && (
                    <div className="space-y-3">
                      <Label>Select Your Role *</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {ROLE_OPTIONS.filter(r => r.value !== 'owner').map((role) => {
                          const isSelected = form.watch('role') === role.value;
                          return (
                            <div
                              key={role.value}
                              onClick={() => form.setValue('role', role.value as any)}
                              className={`
                                flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                                ${isSelected 
                                  ? 'border-primary bg-primary/10' 
                                  : 'border-border hover:border-primary/50'
                                }
                              `}
                            >
                              <div className={`
                                p-2 rounded-full
                                ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                              `}>
                                {roleIcons[role.value] || <User className="h-5 w-5" />}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{role.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {roleDescriptions[role.value]}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {form.formState.errors.role && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.role.message}
                        </p>
                      )}
                    </div>
                  )}

                  {/* First user - Owner role */}
                  {isFirstUser && (
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-full">
                          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-primary">Owner Account</p>
                          <p className="text-sm text-muted-foreground">
                            As the first user, you'll have full system access
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Emergency Contact */}
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact">Emergency Contact (Optional)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="emergencyContact"
                        placeholder="+94 77 987 6543"
                        className="pl-9"
                        disabled={isLoading}
                        {...form.register('emergencyContact')}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-9"
                        disabled={isLoading}
                        {...form.register('password')}
                      />
                    </div>
                    {form.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        className="pl-9"
                        disabled={isLoading}
                        {...form.register('confirmPassword')}
                      />
                    </div>
                    {form.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {/* Approval Notice */}
                  {!isFirstUser && ['draughtsman', 'bass', 'helper'].includes(form.watch('role')) && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
                      <p className="text-yellow-600 dark:text-yellow-400">
                        ⚠️ Your account will require admin approval before you can access the system.
                      </p>
                    </div>
                  )}

                  {/* Button Group */}
                  <div className="flex gap-3">
                    <Button 
                      type="button" 
                      variant="outline"
                      className="flex-1" 
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <Link
                href={ROUTES.LOGIN}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Already have an account? Sign In
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
