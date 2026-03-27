'use client';

/**
 * =====================================================
 * SETTINGS PAGE
 * =====================================================
 * Application and system settings with Firestore persistence.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Settings as SettingsIcon,
  User,
  Building2,
  Bell,
  Shield,
  Palette,
  Clock,
  DollarSign,
  Save,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Globe,
  Mail,
  Phone,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRequireRole, useAuth } from '@/components/providers/auth-provider';
import {
  updateEmployee,
  updateEmployeePhoto,
  getAllSettings,
  saveCompanySettings,
  savePayrollSettings,
  saveAttendanceSettings,
  saveNotificationSettings,
  DEFAULT_COMPANY_SETTINGS,
  DEFAULT_PAYROLL_SETTINGS,
  DEFAULT_ATTENDANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  createAuditLog,
} from '@/services';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type {
  CompanySettings,
  PayrollSettings as PayrollSettingsType,
  AttendanceSettings as AttendanceSettingsType,
  NotificationSettings as NotificationSettingsType,
} from '@/types';
import { AUDIT_EVENTS } from '@/types';

// Settings tabs
const settingsTabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
];

// Toggle switch component
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { user, profile } = useAuth();
  const { isAuthorized } = useRequireRole(['owner', 'ceo', 'manager']);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile?.photoURL || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync tab from URL when it changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // ── Load all settings from Firestore ──
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ['settings'],
    queryFn: getAllSettings,
    staleTime: 5 * 60 * 1000,
  });

  // ── Local form states initialized from Firestore or defaults ──
  const [profileData, setProfileData] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    phone: profile?.phone || '',
  });

  const [companyData, setCompanyData] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [payrollData, setPayrollData] = useState<PayrollSettingsType>(DEFAULT_PAYROLL_SETTINGS);
  const [attendanceData, setAttendanceData] = useState<AttendanceSettingsType>(DEFAULT_ATTENDANCE_SETTINGS);
  const [notifData, setNotifData] = useState<NotificationSettingsType>(DEFAULT_NOTIFICATION_SETTINGS);

  // Hydrate local state once Firestore data loads
  useEffect(() => {
    if (settings) {
      setCompanyData(settings.company);
      setPayrollData(settings.payroll);
      setAttendanceData(settings.attendance);
      setNotifData(settings.notifications);
    }
  }, [settings]);

  // ── Photo upload ──
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploadingPhoto(true);
    try {
      const newPhotoURL = await updateEmployeePhoto(user.uid, file);
      setPhotoPreview(newPhotoURL);
      toast({ title: 'Photo Updated', description: 'Your profile photo has been updated.' });
    } catch (error: any) {
      toast({ title: 'Upload Failed', description: error.message || 'Failed to upload photo', variant: 'destructive' });
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Save handler — saves the tab that is currently active ──
  const handleSave = async () => {
    if (!user || !profile) return;
    setIsSaving(true);

    try {
      switch (activeTab) {
        case 'profile':
          await updateEmployee(user.uid, {
            displayName: profileData.displayName,
            phone: profileData.phone,
          });
          break;

        case 'company':
          await saveCompanySettings(companyData);
          await createAuditLog({
            userId: user.uid,
            userName: profile.displayName || user.email || '',
            userRole: profile.role,
            action: 'update',
            resource: 'settings/company',
            resourceId: 'company',
            newValue: companyData as unknown as Record<string, unknown>,
          });
          break;

        case 'payroll':
          await savePayrollSettings(payrollData);
          await createAuditLog({
            userId: user.uid,
            userName: profile.displayName || user.email || '',
            userRole: profile.role,
            action: 'update',
            resource: 'settings/payroll',
            resourceId: 'payroll',
            newValue: payrollData as unknown as Record<string, unknown>,
          });
          break;

        case 'attendance':
          await saveAttendanceSettings(attendanceData);
          await createAuditLog({
            userId: user.uid,
            userName: profile.displayName || user.email || '',
            userRole: profile.role,
            action: 'update',
            resource: 'settings/attendance',
            resourceId: 'attendance',
            newValue: attendanceData as unknown as Record<string, unknown>,
          });
          break;

        case 'notifications':
          await saveNotificationSettings(notifData);
          await createAuditLog({
            userId: user.uid,
            userName: profile.displayName || user.email || '',
            userRole: profile.role,
            action: 'update',
            resource: 'settings/notifications',
            resourceId: 'notifications',
            newValue: notifData as unknown as Record<string, unknown>,
          });
          break;

        case 'appearance':
          // Theme is persisted by next-themes (localStorage). No Firestore save needed.
          break;

        default:
          break;
      }

      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Settings Saved', description: 'Your settings have been updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthorized) {
    return null;
  }

  const showSaveButton = activeTab !== 'security';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application settings
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <Card className="bg-card/50 lg:w-64 lg:shrink-0">
          <CardContent className="p-2">
            <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap',
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="flex-1 space-y-6">

          {/* Loading state for settings tabs */}
          {settingsLoading && activeTab !== 'profile' && activeTab !== 'appearance' && activeTab !== 'security' && (
            <Card className="bg-card/50">
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Loading settings...</span>
              </CardContent>
            </Card>
          )}

          {/* Error state */}
          {settingsError && activeTab !== 'profile' && activeTab !== 'appearance' && activeTab !== 'security' && (
            <Card className="bg-card/50 border-destructive">
              <CardContent className="flex items-center gap-3 py-6">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Failed to load settings</p>
                  <p className="text-sm text-muted-foreground">Using default values. Changes will still be saved.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Profile ── */}
          {activeTab === 'profile' && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Profile" className="h-20 w-20 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-3xl font-bold text-primary">
                        {profileData.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingPhoto} className="gap-2">
                      <Camera className="h-4 w-4" />
                      {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">Max 5MB. JPG, PNG or GIF.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input value={profileData.displayName} onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))} icon={<User className="h-4 w-4" />} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={profileData.email} disabled className="bg-muted/50" icon={<Mail className="h-4 w-4" />} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={profileData.phone} onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))} icon={<Phone className="h-4 w-4" />} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Company ── */}
          {activeTab === 'company' && !settingsLoading && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Update your company details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Company Name</Label>
                    <Input value={companyData.companyName} onChange={(e) => setCompanyData(prev => ({ ...prev, companyName: e.target.value }))} icon={<Building2 className="h-4 w-4" />} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Address</Label>
                    <Input value={companyData.companyAddress} onChange={(e) => setCompanyData(prev => ({ ...prev, companyAddress: e.target.value }))} icon={<MapPin className="h-4 w-4" />} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={companyData.companyPhone} onChange={(e) => setCompanyData(prev => ({ ...prev, companyPhone: e.target.value }))} icon={<Phone className="h-4 w-4" />} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={companyData.companyEmail} onChange={(e) => setCompanyData(prev => ({ ...prev, companyEmail: e.target.value }))} icon={<Mail className="h-4 w-4" />} />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={companyData.companyWebsite} onChange={(e) => setCompanyData(prev => ({ ...prev, companyWebsite: e.target.value }))} icon={<Globe className="h-4 w-4" />} />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input value={companyData.currency} disabled className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Input value={companyData.timezone} disabled className="bg-muted/50" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Payroll ── */}
          {activeTab === 'payroll' && !settingsLoading && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Payroll Configuration</CardTitle>
                <CardDescription>Configure salary and payment settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Payroll Cycle</Label>
                    <select
                      value={payrollData.cycle}
                      onChange={(e) => setPayrollData(prev => ({ ...prev, cycle: e.target.value as PayrollSettingsType['cycle'] }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Week Start Day</Label>
                    <select
                      value={payrollData.payrollStartDay}
                      onChange={(e) => setPayrollData(prev => ({ ...prev, payrollStartDay: parseInt(e.target.value) }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value={0}>Sunday</option>
                      <option value={1}>Monday</option>
                      <option value={6}>Saturday</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Working Days per Week</Label>
                    <Input type="number" min={1} max={7} value={payrollData.workingDaysPerWeek} onChange={(e) => setPayrollData(prev => ({ ...prev, workingDaysPerWeek: parseInt(e.target.value) || 6 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Regular Hours per Day</Label>
                    <Input type="number" min={1} max={24} value={payrollData.regularHoursPerDay} onChange={(e) => setPayrollData(prev => ({ ...prev, regularHoursPerDay: parseInt(e.target.value) || 8 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>OT Multiplier</Label>
                    <Input type="number" step="0.1" min={1} value={payrollData.otMultiplier} onChange={(e) => setPayrollData(prev => ({ ...prev, otMultiplier: parseFloat(e.target.value) || 1.5 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Holiday Multiplier</Label>
                    <Input type="number" step="0.1" min={1} value={payrollData.holidayMultiplier} onChange={(e) => setPayrollData(prev => ({ ...prev, holidayMultiplier: parseFloat(e.target.value) || 2.0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Advance (% of salary)</Label>
                    <Input type="number" min={0} max={100} value={payrollData.maxAdvancePercent} onChange={(e) => setPayrollData(prev => ({ ...prev, maxAdvancePercent: parseInt(e.target.value) || 50 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Loan EMIs</Label>
                    <Input type="number" min={1} value={payrollData.maxLoanEmis} onChange={(e) => setPayrollData(prev => ({ ...prev, maxLoanEmis: parseInt(e.target.value) || 52 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Interest Rate (%)</Label>
                    <Input type="number" step="0.1" min={0} value={payrollData.defaultInterestRate} onChange={(e) => setPayrollData(prev => ({ ...prev, defaultInterestRate: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <p className="text-sm font-medium text-muted-foreground">Automatic Deductions</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-Deduct Advances</p>
                      <p className="text-sm text-muted-foreground">Automatically deduct approved advances from payroll</p>
                    </div>
                    <Toggle checked={payrollData.autoDeductAdvances} onChange={(v) => setPayrollData(prev => ({ ...prev, autoDeductAdvances: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-Deduct Loans</p>
                      <p className="text-sm text-muted-foreground">Automatically deduct loan EMIs from payroll</p>
                    </div>
                    <Toggle checked={payrollData.autoDeductLoans} onChange={(v) => setPayrollData(prev => ({ ...prev, autoDeductLoans: v }))} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Attendance ── */}
          {activeTab === 'attendance' && !settingsLoading && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Attendance Configuration</CardTitle>
                <CardDescription>Configure attendance tracking settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Auto-Close After (hours)</Label>
                    <Input type="number" min={1} value={attendanceData.autoCloseAfterHours} onChange={(e) => setAttendanceData(prev => ({ ...prev, autoCloseAfterHours: parseInt(e.target.value) || 12 }))} />
                    <p className="text-xs text-muted-foreground">Active sessions will be auto-closed after this many hours</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Session Duration (minutes)</Label>
                    <Input type="number" min={1} value={attendanceData.minSessionMinutes} onChange={(e) => setAttendanceData(prev => ({ ...prev, minSessionMinutes: parseInt(e.target.value) || 30 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Geofence Radius (meters)</Label>
                    <Input type="number" min={10} value={attendanceData.defaultGeofenceRadius} onChange={(e) => setAttendanceData(prev => ({ ...prev, defaultGeofenceRadius: parseInt(e.target.value) || 100 }))} />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Enable Geofencing</p>
                      <p className="text-sm text-muted-foreground">Require employees to be within site radius to check-in</p>
                    </div>
                    <Toggle checked={attendanceData.enableGeofence} onChange={(v) => setAttendanceData(prev => ({ ...prev, enableGeofence: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Allow Half-Day</p>
                      <p className="text-sm text-muted-foreground">Enable half-day attendance marking</p>
                    </div>
                    <Toggle checked={attendanceData.allowHalfDay} onChange={(v) => setAttendanceData(prev => ({ ...prev, allowHalfDay: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Allow Multiple Sessions</p>
                      <p className="text-sm text-muted-foreground">Allow employees to have multiple check-in/out per day</p>
                    </div>
                    <Toggle checked={attendanceData.allowMultipleSessions} onChange={(v) => setAttendanceData(prev => ({ ...prev, allowMultipleSessions: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Lock Past Attendance After Payroll</p>
                      <p className="text-sm text-muted-foreground">Prevent editing attendance for weeks with approved payroll</p>
                    </div>
                    <Toggle checked={attendanceData.lockPastAttendanceAfterPayroll} onChange={(v) => setAttendanceData(prev => ({ ...prev, lockPastAttendanceAfterPayroll: v }))} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Notifications ── */}
          {activeTab === 'notifications' && !settingsLoading && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Configure how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Toggle checked={notifData.emailEnabled} onChange={(v) => setNotifData(prev => ({ ...prev, emailEnabled: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">In-App Notifications</p>
                      <p className="text-sm text-muted-foreground">Show notifications inside the dashboard</p>
                    </div>
                    <Toggle checked={notifData.inAppEnabled} onChange={(v) => setNotifData(prev => ({ ...prev, inAppEnabled: v }))} />
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Notify me about:</p>
                  <div className="flex items-center justify-between">
                    <span>Payroll Alerts</span>
                    <Toggle checked={notifData.payrollAlerts} onChange={(v) => setNotifData(prev => ({ ...prev, payrollAlerts: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Advance Requests</span>
                    <Toggle checked={notifData.advanceAlerts} onChange={(v) => setNotifData(prev => ({ ...prev, advanceAlerts: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Loan Requests</span>
                    <Toggle checked={notifData.loanAlerts} onChange={(v) => setNotifData(prev => ({ ...prev, loanAlerts: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Attendance Alerts</span>
                    <Toggle checked={notifData.attendanceAlerts} onChange={(v) => setNotifData(prev => ({ ...prev, attendanceAlerts: v }))} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Appearance ── */}
          {activeTab === 'appearance' && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <div className="flex gap-2">
                    {([
                      { value: 'light', label: 'Light', Icon: Sun },
                      { value: 'dark', label: 'Dark', Icon: Moon },
                      { value: 'system', label: 'System', Icon: Monitor },
                    ] as const).map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={cn(
                          'flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                          theme === value ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'
                        )}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Security ── */}
          {activeTab === 'security' && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Change Password</p>
                        <p className="text-sm text-muted-foreground">Update your account password</p>
                      </div>
                      <Button variant="outline">Change</Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                      </div>
                      <Button variant="outline">Enable</Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Active Sessions</p>
                        <p className="text-sm text-muted-foreground">Manage your active login sessions</p>
                      </div>
                      <Button variant="outline">View</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          {showSaveButton && (
            <div className="flex items-center justify-between">
              {settings && !settingsLoading && activeTab !== 'profile' && activeTab !== 'appearance' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Settings loaded from Firestore
                </p>
              )}
              <div className="ml-auto">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || (settingsLoading && activeTab !== 'profile' && activeTab !== 'appearance')}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
