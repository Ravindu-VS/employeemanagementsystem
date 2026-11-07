'use client';

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
  verifySiteAttendance,
  getActiveEmployees,
  getAllSites,
  bulkMarkDriverAttendance,
} from '@/services';
import { effectiveWorkerDay, driverAttendanceDocId, isDriverRecord } from '@/domain/attendance';
import { isHigherRoleMultiSite } from '@/domain/roles';
import { isSiteSelectableForAttendance, isSiteReadOnlyForAttendance } from '@/domain/sites';
import { ACCESS_MATRIX } from '@/domain/roles';
import { useRequireRole, useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

import {
  formatDate,
  todayISO,
  addDaysISO,
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
  driver: 'bg-teal-500/20 text-teal-400',
};

// Worker row state for the marking UI
interface WorkerAttendanceRow {
  workerId: string;
  workerName: string;
  role: UserRole;
  morning: boolean;
  evening: boolean;
  otHours: number;
  /** Other sites (ids → shifts) the worker is already marked at on this date */
  otherSites: Record<string, { morning: boolean; evening: boolean }>;
}

export default function AttendancePage() {
  const { isAuthorized } = useRequireRole(ACCESS_MATRIX.attendance);
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dateStr, setDateStr] = useState<string>(() => todayISO());
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [workerRows, setWorkerRows] = useState<WorkerAttendanceRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Guard against re-initializing editable rows every render
  const initializedKeyRef = useRef<string | null>(null);
  // Bumped after each save so rows are rebuilt from the refetched server data
  const [rebuildToken, setRebuildToken] = useState(0);

  const isToday = todayISO() === dateStr;

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

  // ONE authoritative query: every attendance document (all sites + drivers)
  // for the date. The UI is rebuilt from it after every save.
  const { data: allDayAttendance = EMPTY_ATTENDANCE, isLoading, isPending: dayPending, refetch: refetchDay } = useQuery({
    queryKey: ['simple-attendance', dateStr],
    queryFn: () => getSimpleAttendance(dateStr),
    staleTime: 0,
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

  const selectedSite = useMemo(() => {
    return sites.find((s: any) => s.id === selectedSiteId);
  }, [sites, selectedSiteId]);

  const isSiteReadOnly = selectedSite ? isSiteReadOnlyForAttendance(selectedSite) : false;

  // workerId -> number of sites marked today (all documents, normalized)
  const workerSiteCoverage = useMemo(() => {
    const map = new Map<string, number>();
    const workerIds = new Set(allDayAttendance.filter((a) => !isDriverRecord(a)).map((a) => a.workerId));
    workerIds.forEach((wid) => {
      const { sites } = effectiveWorkerDay(allDayAttendance, wid, dateStr);
      map.set(wid, Object.values(sites).filter((s) => s.morning || s.evening).length);
    });
    return map;
  }, [allDayAttendance, dateStr]);

  const initializationKey = `${selectedSiteId}-${dateStr}-${rebuildToken}`;

  useEffect(() => {
    // Only proceed if we have a site and data is loaded
    if (!selectedSiteId) {
      setWorkerRows(prev => prev.length === 0 ? prev : []);
      return;
    }
    
    if (employeesPending || dayPending) {
      return;
    }

    // Initialize local rows ONLY ONCE per site/date combination
    if (initializedKeyRef.current === initializationKey) {
      return;
    }

    // Site workers: everyone except drivers (drivers are not site-based),
    // limited to employees assigned to this site, unassigned employees, and
    // anyone already marked here today.
    const siteEmployees = employees.filter((e) => {
      if (e.role === 'driver') return false;
      const wid = e.workerId || e.uid;
      const markedHere = !!effectiveWorkerDay(allDayAttendance, wid, dateStr).sites[selectedSiteId];
      return markedHere || !e.assignedSites || e.assignedSites.length === 0 || e.assignedSites.includes(selectedSiteId);
    });

    const rows: WorkerAttendanceRow[] = siteEmployees.map((emp) => {
      const wid = emp.workerId || emp.uid;
      const { sites, ot } = effectiveWorkerDay(allDayAttendance, wid, dateStr);
      const here = sites[selectedSiteId] || { morning: false, evening: false };
      const otherSites = { ...sites };
      delete otherSites[selectedSiteId];
      return {
        workerId: wid,
        workerName: emp.displayName || emp.email,
        role: emp.role,
        morning: here.morning,
        evening: here.evening,
        otHours: ot[selectedSiteId] || 0,
        otherSites,
      };
    });

    setWorkerRows(rows);
    setIsDirty(false);
    initializedKeyRef.current = initializationKey;
  }, [
    selectedSiteId,
    dateStr,
    employeesPending,
    dayPending,
    employees,
    allDayAttendance,
    initializationKey
  ]);

  // Toggle a shift. Labor roles may not hold the same shift at two sites.
  const toggleShift = useCallback((workerId: string, shift: 'morning' | 'evening') => {
    if (isSiteReadOnly) return;
    setWorkerRows((prev) =>
      prev.map((row) => {
        if (row.workerId !== workerId) return row;
        const turningOn = !row[shift];
        if (turningOn && !isHigherRoleMultiSite(row.role)) {
          const clash = Object.entries(row.otherSites).find(([, st]) => st[shift]);
          if (clash) {
            toast({
              title: 'Not allowed',
              description: `${row.workerName} is already marked for the ${shift} shift at ${siteNameMap.get(clash[0]) || 'another site'}. Remove it there first.`,
              variant: 'destructive',
            });
            return row;
          }
        }
        return { ...row, [shift]: turningOn };
      })
    );
    setIsDirty(true);
  }, [toast, isSiteReadOnly, siteNameMap]);
  const toggleMorning = useCallback((workerId: string) => toggleShift(workerId, 'morning'), [toggleShift]);
  const toggleEvening = useCallback((workerId: string) => toggleShift(workerId, 'evening'), [toggleShift]);

  // Update OT hours
  const updateOT = useCallback((workerId: string, hours: number) => {
    if (isSiteReadOnly) return;
    setWorkerRows((prev) =>
      prev.map((row) =>
        row.workerId === workerId ? { ...row, otHours: Math.max(0, hours) } : row
      )
    );
    setIsDirty(true);
  }, [isSiteReadOnly]);

  // Save attendance mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSiteId || !profile) throw new Error('Site or user not selected');

      const entries: BulkAttendanceEntry[] = workerRows.map((row) => ({
        workerId: row.workerId,
        workerName: row.workerName,
        role: row.role,
        morning: row.morning,
        evening: row.evening,
        otHours: row.otHours,
      }));

      // 1. write (single transaction)  2. verify from the server
      const result = await bulkMarkSimpleAttendance(dateStr, selectedSiteId, entries, profile.uid);
      const okEntries = entries.filter((e) => !result.errors.some((err) => err.startsWith(`${e.workerName}:`)));
      const mismatches = await verifySiteAttendance(dateStr, selectedSiteId, okEntries);
      return { result, mismatches };
    },
    onSuccess: async ({ result, mismatches }) => {
      // 3. refetch authoritative records  4. rebuild local rows from them
      await refetchDay();
      setRebuildToken((t) => t + 1); // rebuild rows from the authoritative data
      queryClient.invalidateQueries({ queryKey: ['week-attendance'] });
      if (mismatches.length > 0 || result.failed > 0) {
        toast({
          title: 'Attendance partly saved',
          description: [...result.errors, ...(mismatches.length ? [`Not confirmed by server: ${mismatches.join(', ')}`] : [])].join(' • '),
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Attendance saved', description: `${result.success} workers saved and verified` });
      }
      setIsDirty(false);
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save attendance',
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
    if (isDirty && !window.confirm('You have unsaved attendance changes. Discard them?')) return;
    setDateStr((d) => addDaysISO(d, direction === 'prev' ? -1 : 1));
  };

  if (!isAuthorized) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Mark daily attendance — Morning / Evening / OT
          </p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigateDate('prev')} className="h-9 w-9 p-0 sm:h-10 sm:w-10">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 sm:gap-2 rounded-md border border-border bg-background px-2 sm:px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
            <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            <span className="font-medium">{formatDate(dateStr, 'EEE dd/MM/yyyy')}</span>
            {isToday && (
              <span className="rounded bg-primary/20 px-1 sm:px-1.5 py-0.5 text-xs text-primary font-medium">
                Today
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate('next')}
            disabled={isToday}
            className="h-9 w-9 p-0 sm:h-10 sm:w-10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDateStr(todayISO())} className="h-9 text-xs">
              Today
            </Button>
          )}
          {/* Refresh button to reload employee data */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['active-employees'] })}
            title="Refresh employee list if roles changed"
            className="h-9 w-9 p-0 sm:h-10 sm:w-10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Site Selector */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              <label className="font-medium text-sm">Site:</label>
            </div>
            <select
              value={selectedSiteId}
              onChange={(e) => {
                if (isDirty && !window.confirm('You have unsaved attendance changes. Discard them?')) return;
                setSelectedSiteId(e.target.value);
              }}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">— Select a site —</option>
              {sites
                .filter((site: any) => isSiteSelectableForAttendance(site))
                .map((site: any) => (
                  <option key={site.id} value={site.id}>
                    {site.name} — {site.address || site.city || ''} {site.status === 'completed' ? '(Completed - Read-Only)' : ''}
                  </option>
                ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {isSiteReadOnly && (
        <Card className="border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <p className="text-sm font-medium">
              This site is marked as Completed and is in Read-Only mode. Attendance cannot be modified.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Multi-site Rules Info */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-3 sm:p-4">
          <div className="space-y-2 text-xs sm:text-sm">
            <p className="font-medium text-foreground">Multi-Site Work Rules:</p>
            <ul className="list-inside space-y-1 text-muted-foreground">
              <li>✓ <strong className="text-foreground">Owner, CEO, Manager, Supervisor</strong> — can be marked at several sites on the same day (paid per site visit)</li>
              <li>✓ <strong className="text-foreground">Bass, Helper, Draughtsman</strong> — morning and evening may be at different sites (0.5 day each)</li>
              <li>✓ <strong className="text-foreground">Drivers</strong> — marked below in the Drivers section (no site)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {selectedSiteId && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="rounded-lg bg-green-500/20 p-1.5 sm:p-2 shrink-0">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Present</p>
                    <p className="text-xl sm:text-2xl font-bold">{presentCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="rounded-lg bg-blue-500/20 p-1.5 sm:p-2 shrink-0">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Full Day</p>
                    <p className="text-xl sm:text-2xl font-bold">{fullDayCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="rounded-lg bg-yellow-500/20 p-1.5 sm:p-2 shrink-0">
                    <Coffee className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Half Day</p>
                    <p className="text-xl sm:text-2xl font-bold">{halfDayCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="rounded-lg bg-orange-500/20 p-1.5 sm:p-2 shrink-0">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total OT</p>
                    <p className="text-xl sm:text-2xl font-bold">{totalOT}h</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search + Save */}
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search workers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending || isSiteReadOnly}
              className="gap-2 w-full sm:w-auto"
              size="lg"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Save Attendance</span>
              <span className="sm:hidden">Save</span>
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
                        <th className="p-1.5 sm:p-4 font-medium text-xs sm:text-sm text-muted-foreground">Name</th>
                        <th className="p-1 sm:p-4 text-center font-medium text-xs sm:text-sm text-muted-foreground">
                          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                            <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Morning</span>
                          </div>
                        </th>
                        <th className="p-1 sm:p-4 text-center font-medium text-xs sm:text-sm text-muted-foreground">
                          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                            <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Evening</span>
                          </div>
                        </th>
                        <th className="p-1 sm:p-4 text-center font-medium text-xs sm:text-sm text-muted-foreground">OT</th>
                        <th className="p-1 sm:p-4 text-center font-medium text-xs sm:text-sm text-muted-foreground">Status</th>
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
                            <td className="p-1.5 sm:p-4">
                              <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
                                <div className="flex h-7 w-7 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-medium text-primary text-xs sm:text-sm">
                                  {row.workerName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-xs sm:text-sm truncate">{row.workerName}</p>
                                  <span
                                    className={cn(
                                      'inline-flex rounded-full px-1.5 sm:px-2 py-0.5 text-xs font-medium max-w-full',
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
                                onClick={() => !isSiteReadOnly && toggleMorning(row.workerId)}
                                className={cn(
                                  'inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg border-2 text-lg sm:text-xl font-bold transition-all active:scale-95',
                                  row.morning
                                    ? 'border-green-500 bg-green-500/20 text-green-500'
                                    : 'border-border text-muted-foreground hover:border-green-500/50',
                                  isSiteReadOnly && 'opacity-50 cursor-not-allowed'
                                )}
                                disabled={isSiteReadOnly}
                                aria-label={`Morning ${row.morning ? 'present' : 'absent'}`}
                              >
                                {row.morning ? '✓' : '—'}
                              </button>
                            </td>

                            {/* Evening Checkbox — large touch target */}
                            <td className="p-1 sm:p-4 text-center">
                              <button
                                type="button"
                                onClick={() => !isSiteReadOnly && toggleEvening(row.workerId)}
                                className={cn(
                                  'inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg border-2 text-lg sm:text-xl font-bold transition-all active:scale-95',
                                  row.evening
                                    ? 'border-blue-500 bg-blue-500/20 text-blue-500'
                                    : 'border-border text-muted-foreground hover:border-blue-500/50',
                                  isSiteReadOnly && 'opacity-50 cursor-not-allowed'
                                )}
                                disabled={isSiteReadOnly}
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
                                disabled={isSiteReadOnly}
                                className={cn(
                                  "h-10 w-16 sm:h-12 sm:w-20 rounded-lg border border-border bg-background text-center text-xs sm:text-sm font-bold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                                  isSiteReadOnly && "opacity-50 cursor-not-allowed"
                                )}
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
                                    +{row.otHours}h
                                  </span>
                                )}

                                {/* Show total sites covered today only for owner/ceo/manager/supervisor */}
                                {(workerSiteCoverage.get(row.workerId) || 0) > 1 &&
                                  isHigherRoleMultiSite(row.role) && (
                                  <span className="block rounded bg-purple-500/20 px-1 py-0.5 text-xs text-purple-600 dark:text-purple-400 font-medium">
                                    {workerSiteCoverage.get(row.workerId)} sites
                                  </span>
                                )}

                                {/* Labor split between two sites (morning/evening) */}
                                {(workerSiteCoverage.get(row.workerId) || 0) > 1 &&
                                  !isHigherRoleMultiSite(row.role) && (
                                  <span className="block rounded bg-amber-500/20 px-1 py-0.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                                    Split day
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
                disabled={saveMutation.isPending || isSiteReadOnly}
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
          <div className="text-xs sm:text-sm text-muted-foreground">
            Showing {filteredRows.length} of {workerRows.length} workers
          </div>
        </>
      )}

      {/* =====================================================
          DRIVERS ATTENDANCE SECTION
          ===================================================== */}
      <DriversAttendanceSection
        dateStr={dateStr}
        employees={employees}
        profile={profile}
        dayAttendance={allDayAttendance}
        dayPending={dayPending}
        onSaved={refetchDay}
      />
    </div>
  );
}

// =====================================================
// DRIVERS ATTENDANCE SECTION
// =====================================================

interface DriverRow {
  workerId: string;
  workerName: string;
  morningPresent: boolean;
  eveningPresent: boolean;
  morningOtHours: number;
  eveningOtHours: number;
  remarks: string;
}

function DriversAttendanceSection({
  dateStr,
  employees,
  profile,
  dayAttendance,
  dayPending,
  onSaved,
}: {
  dateStr: string;
  employees: any[];
  profile: any;
  dayAttendance: SimpleAttendance[];
  dayPending: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [driverRows, setDriverRows] = useState<DriverRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Get drivers
  const drivers = useMemo(
    () => employees.filter((e: any) => e.role === 'driver'),
    [employees]
  );

  const isLoading = dayPending;
  const driverAttendance = useMemo(
    () => dayAttendance.filter((a) => isDriverRecord(a) && !a.superseded),
    [dayAttendance]
  );

  // Build driver rows from the authoritative day query
  useEffect(() => {
    if (drivers.length === 0) {
      setDriverRows([]);
      return;
    }

    // Prefer the deterministic document; fall back to the latest legacy doc.
    const existingMap = new Map<string, any>();
    const ts = (a: any) => a.updatedAt?.getTime?.() ?? 0;
    for (const a of driverAttendance) {
      const prev = existingMap.get(a.workerId);
      const isDet = a.id === driverAttendanceDocId(a.workerId, dateStr);
      const prevDet = prev && prev.id === driverAttendanceDocId(prev.workerId, dateStr);
      if (!prev || (isDet && !prevDet) || (!prevDet && ts(a) > ts(prev))) existingMap.set(a.workerId, a);
    }

    const rows: DriverRow[] = drivers.map((emp: any) => {
      const existing: any = existingMap.get(emp.workerId || emp.uid);
      return {
        workerId: emp.workerId || emp.uid,
        workerName: emp.displayName || emp.email,
        morningPresent: existing?.morningPresent ?? existing?.present ?? false,
        eveningPresent: existing?.eveningPresent ?? existing?.present ?? false,
        morningOtHours: existing?.morningOtHours ?? 0,
        eveningOtHours: existing?.eveningOtHours ?? 0,
        remarks: existing?.remarks ?? '',
      };
    });

    setDriverRows(rows);
    setIsDirty(false);
  }, [drivers, driverAttendance, dateStr]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Not authenticated');
      const entries = driverRows.map((row) => ({
        workerId: row.workerId,
        workerName: row.workerName,
        morningPresent: row.morningPresent,
        eveningPresent: row.eveningPresent,
        morningOtHours: row.morningOtHours,
        eveningOtHours: row.eveningOtHours,
        remarks: row.remarks,
      }));
      return bulkMarkDriverAttendance(dateStr, entries, profile.uid);
    },
    onSuccess: async (result) => {
      await onSaved();
      toast({
        title: 'Driver attendance saved',
        description: `${result.success} drivers saved${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
      });
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['week-attendance'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save driver attendance', variant: 'destructive' });
    },
  });

  if (drivers.length === 0) return null;

  const morningCount = driverRows.filter((r) => r.morningPresent).length;
  const eveningCount = driverRows.filter((r) => r.eveningPresent).length;

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20">
              <Clock className="h-4 w-4 text-teal-500" />
            </span>
            Drivers Attendance (Shifts)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Morning: {morningCount} present | Evening: {eveningCount} present
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Drivers
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-4 font-medium text-muted-foreground">Driver</th>
                    <th className="p-4 text-center font-medium text-muted-foreground">Morning</th>
                    <th className="p-4 text-center font-medium text-muted-foreground">Evening</th>
                    <th className="p-4 text-center font-medium text-muted-foreground">Morning OT</th>
                    <th className="p-4 text-center font-medium text-muted-foreground">Evening OT</th>
                    <th className="p-4 font-medium text-muted-foreground">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {driverRows.map((row) => (
                    <tr
                      key={row.workerId}
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 font-medium text-teal-500">
                            {row.workerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{row.workerName}</p>
                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-teal-500/20 text-teal-400">
                              Driver
                            </span>
                          </div>
                        </div>
                      </td>
                      {/* Morning Present */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setDriverRows((prev) =>
                              prev.map((r) =>
                                r.workerId === row.workerId ? { ...r, morningPresent: !r.morningPresent } : r
                              )
                            );
                            setIsDirty(true);
                          }}
                          className={cn(
                            'inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg border-2 text-lg sm:text-xl font-bold transition-all active:scale-95',
                            row.morningPresent
                              ? 'border-green-500 bg-green-500/20 text-green-500'
                              : 'border-border text-muted-foreground hover:border-green-500/50'
                          )}
                        >
                          {row.morningPresent ? '✓' : '—'}
                        </button>
                      </td>
                      {/* Evening Present */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setDriverRows((prev) =>
                              prev.map((r) =>
                                r.workerId === row.workerId ? { ...r, eveningPresent: !r.eveningPresent } : r
                              )
                            );
                            setIsDirty(true);
                          }}
                          className={cn(
                            'inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg border-2 text-lg sm:text-xl font-bold transition-all active:scale-95',
                            row.eveningPresent
                              ? 'border-blue-500 bg-blue-500/20 text-blue-500'
                              : 'border-border text-muted-foreground hover:border-blue-500/50'
                          )}
                        >
                          {row.eveningPresent ? '✓' : '—'}
                        </button>
                      </td>
                      {/* Morning OT */}
                      <td className="p-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max="12"
                          step="0.5"
                          value={row.morningOtHours}
                          onChange={(e) => {
                            setDriverRows((prev) =>
                              prev.map((r) =>
                                r.workerId === row.workerId
                                  ? { ...r, morningOtHours: Math.max(0, parseFloat(e.target.value) || 0) }
                                  : r
                              )
                            );
                            setIsDirty(true);
                          }}
                          className="h-10 w-16 rounded-lg border border-border bg-background text-center text-xs sm:text-sm font-bold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>
                      {/* Evening OT */}
                      <td className="p-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max="12"
                          step="0.5"
                          value={row.eveningOtHours}
                          onChange={(e) => {
                            setDriverRows((prev) =>
                              prev.map((r) =>
                                r.workerId === row.workerId
                                  ? { ...r, eveningOtHours: Math.max(0, parseFloat(e.target.value) || 0) }
                                  : r
                              )
                            );
                            setIsDirty(true);
                          }}
                          className="h-10 w-16 rounded-lg border border-border bg-background text-center text-xs sm:text-sm font-bold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>
                      {/* Remarks */}
                      <td className="p-4">
                        <input
                          type="text"
                          value={row.remarks}
                          onChange={(e) => {
                            setDriverRows((prev) =>
                              prev.map((r) =>
                                r.workerId === row.workerId ? { ...r, remarks: e.target.value } : r
                              )
                            );
                            setIsDirty(true);
                          }}
                          placeholder="Route / notes"
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
