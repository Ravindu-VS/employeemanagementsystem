'use client';

/**
 * =====================================================
 * ATTENDANCE PAGE
 * =====================================================
 * Simplified attendance: Morning/Evening checkboxes + OT hours.
 * Supervisor selects a site, sees worker list, taps checkboxes.
 * Designed for <5 seconds per worker interaction.
 */

import { useState, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getSimpleAttendance,
  bulkMarkSimpleAttendance,
  getActiveEmployees,
  getActiveSites,
} from '@/services';
import { useRequireRole, useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  formatDate,
  toISODateString,
} from '@/lib/date-utils';
import type { SimpleAttendance, BulkAttendanceEntry, UserRole } from '@/types';

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

  const dateStr = toISODateString(selectedDate);
  const isToday = toISODateString(new Date()) === dateStr;

  // Fetch sites
  const { data: sites = [] } = useQuery({
    queryKey: ['active-sites'],
    queryFn: getActiveSites,
  });

  // Fetch active employees
  const { data: employees = [] } = useQuery({
    queryKey: ['active-employees'],
    queryFn: getActiveEmployees,
  });

  // Fetch existing attendance for selected date
  const { data: existingAttendance = [], isLoading } = useQuery({
    queryKey: ['simple-attendance', dateStr, selectedSiteId],
    queryFn: () => getSimpleAttendance(dateStr, selectedSiteId || undefined),
    enabled: !!selectedSiteId,
  });

  // Build worker rows when site/date/employees change
  useMemo(() => {
    if (!selectedSiteId || employees.length === 0) {
      setWorkerRows([]);
      return;
    }

    // Get employees assigned to this site (or all if none specifically assigned)
    const siteEmployees = employees.filter(
      (e) => e.assignedSites?.includes(selectedSiteId) || e.assignedSites?.length === 0
    );

    const existingMap = new Map(existingAttendance.map((a) => [a.workerId, a]));

    const rows: WorkerAttendanceRow[] = siteEmployees.map((emp) => {
      const existing = existingMap.get(emp.workerId || emp.uid);
      return {
        workerId: emp.workerId || emp.uid,
        workerName: emp.displayName || emp.email,
        role: emp.role,
        morning: existing ? existing.morningSite === selectedSiteId : false,
        evening: existing ? existing.eveningSite === selectedSiteId : false,
        otHours: existing?.otHours || 0,
        existing,
      };
    });

    setWorkerRows(rows);
    setIsDirty(false);
  }, [selectedSiteId, employees, existingAttendance]);

  // Toggle morning checkbox
  const toggleMorning = useCallback((workerId: string) => {
    setWorkerRows((prev) =>
      prev.map((row) =>
        row.workerId === workerId ? { ...row, morning: !row.morning } : row
      )
    );
    setIsDirty(true);
  }, []);

  // Toggle evening checkbox
  const toggleEvening = useCallback((workerId: string) => {
    setWorkerRows((prev) =>
      prev.map((row) =>
        row.workerId === workerId ? { ...row, evening: !row.evening } : row
      )
    );
    setIsDirty(true);
  }, []);

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

      return bulkMarkSimpleAttendance(dateStr, selectedSiteId, entries, profile.uid);
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
                        <th className="p-4 font-medium text-muted-foreground">Name</th>
                        <th className="p-4 text-center font-medium text-muted-foreground">
                          <div className="flex items-center justify-center gap-1">
                            <Sun className="h-4 w-4" /> Morning
                          </div>
                        </th>
                        <th className="p-4 text-center font-medium text-muted-foreground">
                          <div className="flex items-center justify-center gap-1">
                            <Moon className="h-4 w-4" /> Evening
                          </div>
                        </th>
                        <th className="p-4 text-center font-medium text-muted-foreground">OT (hrs)</th>
                        <th className="p-4 text-center font-medium text-muted-foreground">Status</th>
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
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
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
                            <td className="p-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggleMorning(row.workerId)}
                                className={cn(
                                  'inline-flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xl font-bold transition-all active:scale-95',
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
                            <td className="p-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggleEvening(row.workerId)}
                                className={cn(
                                  'inline-flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xl font-bold transition-all active:scale-95',
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
                            <td className="p-4 text-center">
                              <input
                                type="number"
                                min="0"
                                max="12"
                                step="0.5"
                                value={row.otHours}
                                onChange={(e) =>
                                  updateOT(row.workerId, parseFloat(e.target.value) || 0)
                                }
                                className="h-12 w-16 rounded-lg border border-border bg-background text-center text-lg font-bold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </td>

                            {/* Status */}
                            <td className="p-4 text-center">
                              <span className={cn('font-medium text-sm', statusColor)}>
                                {status}
                              </span>
                              {row.otHours > 0 && (
                                <span className="ml-1 text-xs text-orange-500">
                                  +{row.otHours}h OT
                                </span>
                              )}
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
