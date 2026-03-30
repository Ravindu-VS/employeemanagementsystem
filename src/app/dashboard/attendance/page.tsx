'use client';

import { extractOtHours } from "@/domain/attendance";

/**
 * =====================================================
 * ATTENDANCE PAGE
 * =====================================================
 * Simplified attendance: Morning/Evening checkboxes + OT hours.
 * Supervisor selects a site, sees worker list, taps checkboxes.
 * Designed for <5 seconds per worker interaction.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  MapPin,
  CheckCircle,
  XCircle,
  Coffee,
  Save,
  Loader2,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getSimpleAttendance,
  bulkMarkSimpleAttendance,
  getActiveEmployees,
  getAllSites,
} from '@/services';
import { useRequireRole, useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

import {
  formatDate,
  toISODateString,
} from '@/lib/date-utils';
import type { SimpleAttendance, BulkAttendanceEntry, UserRole } from '@/types';

const EMPTY_ATTENDANCE: SimpleAttendance[] = [];
const EMPTY_EMPLOYEES: any[] = [];
const EMPTY_SITES: any[] = [];

// Role badge colors
const roleBadgeColors: Record<UserRole, string> = {
  owner: 'bg-purple-500/20 text-purple-400',
  ceo: 'bg-blue-500/20 text-blue-400',
  manager: 'bg-cyan-500/20 text-cyan-400',
  supervisor: 'bg-green-500/20 text-green-400',
  draughtsman: 'bg-yellow-500/20 text-yellow-400',
  bass: 'bg-orange-500/20 text-orange-400',
  helper: 'bg-gray-500/20 text-gray-400',
};

// Worker row state for the marking UI
interface WorkerAttendanceRow {
  workerId: string;
  workerName: string;
  role: UserRole;
  morning: boolean;
  evening: boolean;
  otHours: number;
  existing?: SimpleAttendance;
}

export default function AttendancePage() {
  const { isAuthorized } = useRequireRole(['owner', 'ceo', 'manager', 'supervisor']);
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [workerRows, setWorkerRows] = useState<WorkerAttendanceRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Guard against re-initializing editable rows every render
  const initializedKeyRef = useRef<string | null>(null);

  const dateStr = toISODateString(selectedDate);
  const isToday = toISODateString(new Date()) === dateStr;

  // Fetch sites
  const { data: sites = EMPTY_SITES } = useQuery({
    queryKey: ['sites'],
    queryFn: getAllSites,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch active employees
  const { data: employees = EMPTY_EMPLOYEES, isPending: employeesPending } = useQuery({
    queryKey: ['active-employees'],
    queryFn: getActiveEmployees,
    staleTime: 30 * 1000, // 30 seconds — refresh quickly when roles change
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch existing attendance for ENTIRE date (all sites) to show supervisor coverage
  const { data: allDayAttendance = EMPTY_ATTENDANCE, isLoading } = useQuery({
    queryKey: ['simple-attendance-all', dateStr],
    queryFn: () => getSimpleAttendance(dateStr), // No siteId filter — get all sites
    staleTime: 1 * 60 * 1000, // 1 minute for attendance
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Also fetch current site's attendance (needed for form)
  const { data: siteAttendance = EMPTY_ATTENDANCE, isPending: siteAttendancePending } = useQuery({
    queryKey: ['simple-attendance', dateStr, selectedSiteId],
    queryFn: () => getSimpleAttendance(dateStr, selectedSiteId || undefined),
    enabled: !!selectedSiteId,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Build site name map for display
  const siteNameMap = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site: any) => {
      map.set(site.id, site.name);
    });
    return map;
  }, [sites]);

  // Build map: workerId -> set of siteIds where worker is marked any shift
  const workerSiteCoverage = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const att of allDayAttendance) {
      const sites = new Set<string>();

      // Handle both labor (morning/evening) and supervisor (siteVisits) models
      if (att.morningSite) sites.add(att.morningSite);
      if (att.eveningSite) sites.add(att.eveningSite);
      (att.siteVisits || []).forEach(visit => {
        if (visit.visited) sites.add(visit.siteId);
      });

      if (sites.size > 0) {
        map.set(att.workerId, sites);
      }
    }
    return map;
  }, [allDayAttendance]);

  // Build map for current site only (for form data)
  const siteAttendanceMap = useMemo(
    () => new Map(siteAttendance.map((a) => [a.workerId, a])),
    [siteAttendance]
  );

  const initializationKey = `${selectedSiteId}-${dateStr}`;

  useEffect(() => {
    // Only proceed if we have a site and data is loaded
    if (!selectedSiteId) {
      setWorkerRows(prev => prev.length === 0 ? prev : []);
      return;
    }
    
    if (employeesPending || siteAttendancePending) {
      return;
    }

    // Initialize local rows ONLY ONCE per site/date combination
    if (initializedKeyRef.current === initializationKey) {
      return;
    }

    // Get employees assigned to this site (or all if none specifically assigned)
    const siteEmployees = employees.filter(
      (e) => e.assignedSites?.includes(selectedSiteId) || e.assignedSites?.length === 0
    );

    const rows: WorkerAttendanceRow[] = siteEmployees.map((emp) => {
      const existing = siteAttendanceMap.get(emp.workerId || emp.uid);
      const isSupervisor = ['owner', 'ceo', 'manager', 'supervisor'].includes(emp.role);

      // For supervisors: check if siteId is in siteVisits array
      // For labor: check if siteId matches morningSite or eveningSite
      let morning = false;
      let evening = false;

      if (isSupervisor && existing?.siteVisits) {
        const visited = existing.siteVisits.find(v => v.siteId === selectedSiteId)?.visited;
        morning = visited || false;
        evening = visited || false; // Both use same visited flag for supervisors
      } else {
        morning = existing ? existing.morningSite === selectedSiteId : false;
        evening = existing ? existing.eveningSite === selectedSiteId : false;
      }

      return {
        workerId: emp.workerId || emp.uid,
        workerName: emp.displayName || emp.email,
        role: emp.role,
        morning,
        evening,
        otHours: existing ? extractOtHours(existing, selectedSiteId) : 0,
        existing,
      };
    });

    setWorkerRows(rows);
    setIsDirty(false);
    initializedKeyRef.current = initializationKey;
  }, [
    selectedSiteId, 
    dateStr,
    employeesPending, 
    siteAttendancePending, 
    employees, 
    siteAttendanceMap,
    initializationKey
  ]);

  // Toggle morning checkbox
  const toggleMorning = useCallback((workerId: string) => {
    setWorkerRows((prev) =>
      prev.map((row) => {
        if (row.workerId !== workerId) return row;

        const worker = employees.find(e => (e.workerId || e.uid) === workerId);
        const canMultipleSites = worker && ['owner', 'ceo', 'manager', 'supervisor'].includes(worker.role);

        // If bass/helper and trying to mark at different site
        if (!canMultipleSites && !row.morning && row.existing?.morningSite && row.existing.morningSite !== selectedSiteId) {
          toast({
            title: 'Not Allowed',
            description: `${worker?.role} cannot work multiple sites. Morning already marked at different site.`,
            variant: 'destructive',
          });
          return row;
        }

        // If bass/helper and evening is marked at different site
        if (!canMultipleSites && !row.morning && row.evening && row.existing?.eveningSite && row.existing.eveningSite !== selectedSiteId) {
          toast({
            title: 'Not Allowed',
            description: `${worker?.role} must have half-day at each site. Evening already marked at different site.`,
            variant: 'destructive',
          });
          return row;
        }

        return { ...row, morning: !row.morning };
      })
    );
    setIsDirty(true);
  }, [selectedSiteId, employees, toast]);

  // Toggle evening checkbox
  const toggleEvening = useCallback((workerId: string) => {
    setWorkerRows((prev) =>
      prev.map((row) => {
        if (row.workerId !== workerId) return row;

        const worker = employees.find(e => (e.workerId || e.uid) === workerId);
        const canMultipleSites = worker && ['owner', 'ceo', 'manager', 'supervisor'].includes(worker.role);

        // If bass/helper and trying to mark at different site
        if (!canMultipleSites && !row.evening && row.existing?.eveningSite && row.existing.eveningSite !== selectedSiteId) {
          toast({
            title: 'Not Allowed',
            description: `${worker?.role} cannot work multiple sites. Evening already marked at different site.`,
            variant: 'destructive',
          });
          return row;
        }

        // If bass/helper and morning is marked at different site
        if (!canMultipleSites && !row.evening && row.morning && row.existing?.morningSite && row.existing.morningSite !== selectedSiteId) {
          toast({
            title: 'Not Allowed',
            description: `${worker?.role} must have half-day at each site. Morning already marked at different site.`,
            variant: 'destructive',
          });
          return row;
        }

        return { ...row, evening: !row.evening };
      })
    );
    setIsDirty(true);
  }, [selectedSiteId, employees, toast]);

  // Update OT hours
  const updateOT = useCallback((workerId: string, hours: number) => {
    setWorkerRows((prev) =>
      prev.map((row) =>
        row.workerId === workerId ? { ...row, otHours: Math.max(0, hours) } : row
      )
    );
    setIsDirty(true);
  }, []);

  // Save attendance mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSiteId || !profile) throw new Error('Site or user not selected');

      const entries: BulkAttendanceEntry[] = workerRows.map((row) => ({
        workerId: row.workerId,
        workerName: row.workerName,
        morning: row.morning,
        evening: row.evening,
        otHours: row.otHours,
      }));

      // Build workerRoles map for role-aware processing
      const workerRoles: Record<string, string> = {};
      workerRows.forEach((row) => {
        workerRoles[row.workerId] = row.role;
      });

      return bulkMarkSimpleAttendance(dateStr, selectedSiteId, entries, profile.uid, workerRoles);
    },
    onSuccess: (result) => {
      toast({
        title: 'Attendance Saved',
        description: `${result.success} workers marked${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
      });
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['simple-attendance'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save attendance',
        variant: 'destructive',
      });
    },
  });

  // Stats
  const presentCount = workerRows.filter((r) => r.morning || r.evening).length;
  const fullDayCount = workerRows.filter((r) => r.morning && r.evening).length;
  const halfDayCount = workerRows.filter(
    (r) => (r.morning && !r.evening) || (!r.morning && r.evening)
  ).length;
  const totalOT = workerRows.reduce((sum, r) => sum + r.otHours, 0);

  // Filter workers by search
  const filteredRows = workerRows.filter((row) => {
    if (!searchQuery) return true;
    return row.workerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const navigateDate = (direction: 'prev' | 'next') => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + (direction === 'prev' ? -1 : 1));
    setSelectedDate(d);
  };

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground">
            Mark daily attendance — Morning / Evening / OT
          </p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatDate(selectedDate)}</span>
            {isToday && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                Today
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate('next')}
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
              Today
            </Button>
          )}
          {/* Refresh button to reload employee data */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['active-employees'] })}
            title="Refresh employee list if roles changed"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Site Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <label className="font-medium">Select Site:</label>
            </div>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">— Select a site —</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} — {site.address || site.city || ''}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Multi-site Rules Info */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">Multi-Site Work Rules:</p>
            <ul className="list-inside space-y-1 text-muted-foreground text-xs">
              <li>✓ <strong className="text-foreground">Owner, CEO, Manager, Supervisor</strong> — Can visit multiple sites daily</li>
              <li>✓ <strong className="text-foreground">Bass, Helper, Draughtsman</strong> — Morning at one site, evening at another (half-day each)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {selectedSiteId && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-500/20 p-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Present</p>
                    <p className="text-2xl font-bold">{presentCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/20 p-2">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Full Day</p>
                    <p className="text-2xl font-bold">{fullDayCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-yellow-500/20 p-2">
                    <Coffee className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Half Day</p>
                    <p className="text-2xl font-bold">{halfDayCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-orange-500/20 p-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total OT</p>
                    <p className="text-2xl font-bold">{totalOT}h</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search + Save */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search workers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending}
              className="gap-2"
              size="lg"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Attendance
            </Button>
          </div>

          {/* Attendance Table — Fast Marking UI */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Users className="h-12 w-12" />
                  <p>No workers assigned to this site</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="p-2 sm:p-4 font-medium text-xs sm:text-sm text-muted-foreground">Name</th>
                        <th className="p-2 sm:p-4 text-center font-medium text-xs sm:text-sm text-muted-foreground">
                          <div className="flex items-center justify-center gap-1">
                            <Sun className="h-4 w-4" /> <span className="hidden sm:inline">Morning</span>
                          </div>
                        </th>
                        <th className="p-2 sm:p-4 text-center font-medium text-xs sm:text-sm text-muted-foreground">
                          <div className="flex items-center justify-center gap-1">
                            <Moon className="h-4 w-4" /> <span className="hidden sm:inline">Evening</span>
                          </div>
                        </th>
                        <th className="p-2 sm:p-4 text-center font-medium text-xs sm:text-sm text-muted-foreground">OT</th>
                        <th className="p-2 sm:p-4 text-center font-medium text-xs sm:text-sm text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => {
                        const status =
                          row.morning && row.evening
                            ? 'Full Day'
                            : row.morning || row.evening
                            ? 'Half Day'
                            : 'Absent';
                        const statusColor =
                          status === 'Full Day'
                            ? 'text-green-500'
                            : status === 'Half Day'
                            ? 'text-yellow-500'
                            : 'text-red-400';

                        return (
                          <tr
                            key={row.workerId}
                            className="border-b border-border/50 transition-colors hover:bg-muted/30"
                          >
                            {/* Name + Role */}
                            <td className="p-2 sm:p-4">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/20 font-medium text-primary text-xs sm:text-sm">
                                  {row.workerName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium">{row.workerName}</p>
                                  <span
                                    className={cn(
                                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                      roleBadgeColors[row.role]
                                    )}
                                  >
                                    {row.role}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Morning Checkbox — large touch target */}
                            <td className="p-1 sm:p-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggleMorning(row.workerId)}
                                className={cn(
                                  'inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg border-2 text-lg sm:text-xl font-bold transition-all active:scale-95',
                                  row.morning
                                    ? 'border-green-500 bg-green-500/20 text-green-500'
                                    : 'border-border text-muted-foreground hover:border-green-500/50'
                                )}
                                aria-label={`Morning ${row.morning ? 'present' : 'absent'}`}
                              >
                                {row.morning ? '✓' : '—'}
                              </button>
                            </td>

                            {/* Evening Checkbox — large touch target */}
                            <td className="p-1 sm:p-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggleEvening(row.workerId)}
                                className={cn(
                                  'inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg border-2 text-lg sm:text-xl font-bold transition-all active:scale-95',
                                  row.evening
                                    ? 'border-blue-500 bg-blue-500/20 text-blue-500'
                                    : 'border-border text-muted-foreground hover:border-blue-500/50'
                                )}
                                aria-label={`Evening ${row.evening ? 'present' : 'absent'}`}
                              >
                                {row.evening ? '✓' : '—'}
                              </button>
                            </td>

                            {/* OT Hours — compact number input */}
                            <td className="p-1 sm:p-4 text-center">
                              <input
                                type="number"
                                min="0"
                                max="12"
                                step="0.5"
                                value={row.otHours}
                                onChange={(e) =>
                                  updateOT(row.workerId, parseFloat(e.target.value) || 0)
                                }
                                className="h-10 w-16 sm:h-12 sm:w-20 rounded-lg border border-border bg-background text-center text-xs sm:text-sm font-bold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </td>

                            {/* Status + Multi-site Indicator (only for allowed roles) */}
                            <td className="p-1 sm:p-4 text-center">
                              <div className="space-y-0.5 sm:space-y-1">
                                <span className={cn('block font-medium text-xs sm:text-sm', statusColor)}>
                                  {status}
                                </span>
                                {row.otHours > 0 && (
                                  <span className="block text-xs text-orange-500">
                                    +{row.otHours}h OT
                                  </span>
                                )}

                                {/* Show total sites covered today only for owner/ceo/manager/supervisor */}
                                {(workerSiteCoverage.get(row.workerId)?.size || 0) > 1 &&
                                  ['owner', 'ceo', 'manager', 'supervisor'].includes(row.role) && (
                                  <span className="block rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400 font-medium">
                                    {workerSiteCoverage.get(row.workerId)?.size || 0} sites today
                                  </span>
                                )}

                                {/* Warning for bass/helper if marked at multiple sites */}
                                {(workerSiteCoverage.get(row.workerId)?.size || 0) > 1 &&
                                  ['bass', 'helper', 'draughtsman'].includes(row.role) && (
                                  <span className="block rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400 font-medium">
                                    ⚠️ Split between sites
                                  </span>
                                )}
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

          {/* Bottom Save Bar (mobile-friendly) */}
          {isDirty && (
            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background p-4 shadow-lg md:hidden">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full gap-2"
                size="lg"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Attendance ({presentCount} present)
              </Button>
            </div>
          )}

          {/* Info */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredRows.length} of {workerRows.length} workers
          </div>
        </>
      )}
    </div>
  );
}
