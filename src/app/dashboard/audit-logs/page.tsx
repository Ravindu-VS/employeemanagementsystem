'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatDate } from '@/lib/date-utils';
import { AuditLog } from '@/types';
import { getAuditLogs } from '@/services/audit-service';
import { 
  Search, 
  Filter,
  FileText,
  User,
  Clock,
  Activity,
  RefreshCw,
  Download,
  Calendar,
  Loader2
} from 'lucide-react';

// Action type badges
const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'payment', label: 'Payment' },
];

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  // Fetch all recent audit logs (simple single-field orderBy, no compound indexes)
  const { data: logs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => getAuditLogs(200),
  });

  // All filtering done client-side to avoid Firestore compound index issues
  const filteredLogs = useMemo(() => {
    return (logs as AuditLog[]).filter(log => {
      // Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      // Date range filter
      if (dateRange.start) {
        const start = new Date(dateRange.start);
        const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
        if (logDate < start) return false;
      }
      if (dateRange.end) {
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
        if (logDate > end) return false;
      }
      // Search term filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          log.action?.toLowerCase().includes(term) ||
          log.resource?.toLowerCase().includes(term) ||
          log.userId?.toLowerCase().includes(term) ||
          log.userName?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [logs, actionFilter, dateRange, searchTerm]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'update':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'delete':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'login':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'logout':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'approve':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'reject':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'payment':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const handleExportLogs = () => {
    // Convert logs to CSV
    const headers = ['Timestamp', 'Action', 'Resource', 'Resource ID', 'User ID', 'User Name', 'IP Address'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => [
        formatDateTime(log.timestamp),
        log.action,
        log.resource,
        log.resourceId,
        log.userId,
        `"${(log.userName || '').replace(/"/g, '""')}"`,
        log.ipAddress || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${formatDate(new Date())}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">Track all system activities and changes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Activity className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Logs</p>
                <p className="text-2xl font-bold">{logs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <FileText className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Create Actions</p>
                <p className="text-2xl font-bold">
                  {logs.filter(l => l.action === 'create').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <User className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Update Actions</p>
                <p className="text-2xl font-bold">
                  {logs.filter(l => l.action === 'update').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <Clock className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delete Actions</p>
                <p className="text-2xl font-bold">
                  {logs.filter(l => l.action === 'delete').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Action Type Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {ACTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                placeholder="Start Date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                placeholder="End Date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {logs.length} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Action</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Resource</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Resource ID</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm whitespace-nowrap">
                            {formatDateTime(log.timestamp)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm">{log.resource}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-muted-foreground truncate max-w-[150px] block">
                          {log.resourceId}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm truncate max-w-[120px]">
                            {log.userName || log.userId || 'System'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                          {log.newValue ? JSON.stringify(log.newValue).substring(0, 50) + '...' : '-'}
                        </span>
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
