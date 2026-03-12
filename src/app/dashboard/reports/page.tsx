'use client';

/**
 * =====================================================
 * REPORTS PAGE
 * =====================================================
 * Generate and view various reports.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText,
  Download,
  Calendar,
  Users,
  DollarSign,
  Clock,
  Building2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Filter,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getAllEmployees, getActiveSites } from '@/services';
import { useRequireRole } from '@/components/providers/auth-provider';
import { formatCurrency, cn } from '@/lib/utils';
import { 
  formatDate, 
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  getWeekNumber,
} from '@/lib/date-utils';

// Report types
const reportTypes = [
  {
    id: 'attendance-summary',
    title: 'Attendance Summary',
    description: 'Daily/weekly attendance overview for all employees',
    icon: Clock,
    color: 'bg-blue-500/20 text-blue-400',
  },
  {
    id: 'payroll-summary',
    title: 'Payroll Summary',
    description: 'Weekly salary disbursement and deductions',
    icon: DollarSign,
    color: 'bg-green-500/20 text-green-400',
  },
  {
    id: 'employee-report',
    title: 'Employee Report',
    description: 'Individual employee performance and history',
    icon: Users,
    color: 'bg-purple-500/20 text-purple-400',
  },
  {
    id: 'site-report',
    title: 'Site Report',
    description: 'Work site attendance and manpower allocation',
    icon: Building2,
    color: 'bg-orange-500/20 text-orange-400',
  },
  {
    id: 'overtime-report',
    title: 'Overtime Report',
    description: 'OT hours and payments by employee',
    icon: TrendingUp,
    color: 'bg-yellow-500/20 text-yellow-400',
  },
  {
    id: 'financial-summary',
    title: 'Financial Summary',
    description: 'Advances, loans, and deductions overview',
    icon: BarChart3,
    color: 'bg-cyan-500/20 text-cyan-400',
  },
];

export default function ReportsPage() {
  const { isAuthorized } = useRequireRole(['owner', 'ceo', 'manager']);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'custom'>('week');
  const [customDates, setCustomDates] = useState({
    start: formatDate(startOfWeek(new Date())),
    end: formatDate(endOfWeek(new Date())),
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: getAllEmployees,
  });

  // Fetch sites
  const { data: sites = [] } = useQuery({
    queryKey: ['active-sites'],
    queryFn: getActiveSites,
  });

  // Calculate quick stats
  const activeEmployees = employees.filter(e => e.isActive).length;
  const activeSites = sites.length;
  const weekNumber = getWeekNumber(new Date());

  const handleGenerateReport = async (reportId: string) => {
    setIsGenerating(true);
    setSelectedReport(reportId);
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsGenerating(false);
  };

  const handleDownload = (format: 'pdf' | 'excel') => {
    // TODO: Implement actual download
    console.log(`Downloading ${selectedReport} as ${format}`);
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">
            Generate and download various reports
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Employees</p>
                <p className="text-2xl font-bold">{activeEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/20 p-2">
                <Building2 className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Sites</p>
                <p className="text-2xl font-bold">{activeSites}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/20 p-2">
                <Calendar className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Week</p>
                <p className="text-2xl font-bold">Week {weekNumber}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/20 p-2">
                <FileText className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reports Available</p>
                <p className="text-2xl font-bold">{reportTypes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Selector */}
      <Card className="bg-card/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Date Range:</span>
              <div className="flex rounded-md border border-border">
                <button
                  onClick={() => setDateRange('week')}
                  className={cn(
                    'px-3 py-1.5 text-sm transition-colors',
                    dateRange === 'week' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  )}
                >
                  This Week
                </button>
                <button
                  onClick={() => setDateRange('month')}
                  className={cn(
                    'border-x border-border px-3 py-1.5 text-sm transition-colors',
                    dateRange === 'month' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  )}
                >
                  This Month
                </button>
                <button
                  onClick={() => setDateRange('custom')}
                  className={cn(
                    'px-3 py-1.5 text-sm transition-colors',
                    dateRange === 'custom' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  )}
                >
                  Custom
                </button>
              </div>
            </div>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDates.start}
                  onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={customDates.end}
                  onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Types Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          const isSelected = selectedReport === report.id;
          
          return (
            <Card 
              key={report.id} 
              className={cn(
                'bg-card/50 cursor-pointer transition-all hover:bg-card/80',
                isSelected && 'ring-2 ring-primary'
              )}
              onClick={() => setSelectedReport(report.id)}
            >
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className={cn('rounded-lg p-2', report.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                        Selected
                      </span>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-foreground">{report.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {report.description}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateReport(report.id);
                      }}
                      disabled={isGenerating}
                    >
                      {isGenerating && selectedReport === report.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BarChart3 className="h-3.5 w-3.5" />
                      )}
                      Generate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload('pdf');
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Report Preview Area */}
      {selectedReport && (
        <Card className="bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {reportTypes.find(r => r.id === selectedReport)?.title}
                </CardTitle>
                <CardDescription>
                  {dateRange === 'week' && `Week ${weekNumber}, ${new Date().getFullYear()}`}
                  {dateRange === 'month' && formatDate(new Date(), 'MMMM yyyy')}
                  {dateRange === 'custom' && `${customDates.start} to ${customDates.end}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border">
              <div className="text-center text-muted-foreground">
                <PieChart className="mx-auto h-12 w-12 mb-2" />
                <p>Report preview will appear here</p>
                <p className="text-sm">Click Generate to create the report</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle>Quick Reports</CardTitle>
          <CardDescription>
            Commonly requested reports with one-click generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <Clock className="h-5 w-5 text-blue-400" />
              <span>Today's Attendance</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <DollarSign className="h-5 w-5 text-green-400" />
              <span>This Week's Payroll</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <TrendingUp className="h-5 w-5 text-orange-400" />
              <span>Monthly OT Summary</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <Users className="h-5 w-5 text-purple-400" />
              <span>Employee List</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
