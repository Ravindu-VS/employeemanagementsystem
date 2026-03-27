"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  MapPin,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Wallet,
  AlertCircle,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { ROUTES, USER_ROLES } from "@/constants";
import { cn } from "@/lib/utils";
import { formatDate, toISODateString } from "@/lib/date-utils";
import { subDays, format } from "date-fns";
import {
  getAllEmployees,
  getAllSites,
  getSimpleAttendance,
  getSimpleAttendanceForDateRange,
  getPendingAdvances,
  getPendingLoans,
} from "@/services";
import type { UserRole } from "@/types";

/**
 * Dashboard Overview Page
 */

// Stat card component
interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  iconClassName?: string;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  iconClassName,
}: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            iconClassName || "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs mt-2",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{trend.value}% from last week</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Quick action card component
interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
}

function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
  color,
}: QuickActionProps) {
  return (
    <Link href={href}>
      <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
        <CardContent className="flex items-center gap-4 p-4">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg",
              color
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardContent>
      </Card>
    </Link>
  );
}

const quickActions: QuickActionProps[] = [
  {
    title: "View Attendance",
    description: "Check today's attendance",
    href: ROUTES.ATTENDANCE.LIST,
    icon: Clock,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    title: "Generate Payroll",
    description: "Process weekly salaries",
    href: ROUTES.PAYROLL.LIST,
    icon: DollarSign,
    color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  },
  {
    title: "Add Employee",
    description: "Register new employee",
    href: ROUTES.EMPLOYEES.CREATE,
    icon: Users,
    color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  },
  {
    title: "Manage Sites",
    description: "View work sites",
    href: ROUTES.SITES.LIST,
    icon: MapPin,
    color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  },
];

export default function DashboardPage() {
  const { profile } = useAuth();

  const todayStr = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = toISODateString(subDays(new Date(), 6));

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: getAllEmployees,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: getAllSites,
  });

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["simpleAttendance", todayStr],
    queryFn: () => getSimpleAttendance(todayStr),
  });

  const { data: weekAttendance = [] } = useQuery({
    queryKey: ["weekAttendance", sevenDaysAgo, todayStr],
    queryFn: () => getSimpleAttendanceForDateRange(sevenDaysAgo, todayStr),
  });

  const { data: pendingAdvances = [] } = useQuery({
    queryKey: ["pendingAdvances"],
    queryFn: getPendingAdvances,
  });

  const { data: pendingLoans = [] } = useQuery({
    queryKey: ["pendingLoans"],
    queryFn: getPendingLoans,
  });

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.isActive !== false).length;
  const totalSites = sites.length;
  const activeSites = sites.filter((s) => s.status === "active").length;
  const todayPresent = todayAttendance.filter((a) => a.morningSite || a.eveningSite).length;
  const todayAbsent = activeEmployees - todayPresent;
  const pendingAdvanceCount = pendingAdvances.length;
  const pendingLoanCount = pendingLoans.length;

  // Prepare attendance chart data (last 7 days)
  const attendanceChartData = React.useMemo(() => {
    const days: { date: string; label: string; present: number; absent: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = toISODateString(date);
      const dayRecords = weekAttendance.filter(a => a.date === dateStr);
      const present = dayRecords.filter(a => a.morningSite || a.eveningSite).length;
      days.push({
        date: dateStr,
        label: format(date, 'EEE'),
        present,
        absent: Math.max(0, activeEmployees - present),
      });
    }
    return days;
  }, [weekAttendance, activeEmployees]);

  // Prepare role distribution data for pie chart
  const roleChartData = React.useMemo(() => {
    const roleCounts: Record<string, number> = {};
    employees.forEach(emp => {
      const label = USER_ROLES[emp.role as UserRole]?.label || emp.role;
      roleCounts[label] = (roleCounts[label] || 0) + 1;
    });
    return Object.entries(roleCounts).map(([name, value]) => ({ name, value }));
  }, [employees]);

  const ROLE_COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#6b7280'];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your workforce.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{formatDate(new Date(), 'DATE_LONG')}</span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={totalEmployees}
          description={`${activeEmployees} active`}
          icon={Users}
        />
        <StatCard
          title="Present Today"
          value={todayPresent}
          description={`${todayAbsent < 0 ? 0 : todayAbsent} absent`}
          icon={UserCheck}
          iconClassName="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          title="Active Sites"
          value={activeSites}
          description={`of ${totalSites} total sites`}
          icon={MapPin}
          iconClassName="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingAdvanceCount + pendingLoanCount}
          description={`${pendingAdvanceCount} advances, ${pendingLoanCount} loans`}
          icon={Wallet}
          iconClassName="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        />
      </div>

      {/* Pending items alert */}
      {(pendingAdvanceCount > 0 || pendingLoanCount > 0) && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Pending Approvals
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {pendingAdvanceCount} advance requests and {pendingLoanCount} loan requests need your attention
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={ROUTES.ADVANCES.LIST}>View Advances</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={ROUTES.LOANS.LIST}>View Loans</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions and Recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
          <div className="grid gap-3">
            {quickActions.map((action) => (
              <QuickActionCard key={action.title} {...action} />
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href={ROUTES.AUDIT_LOGS}>View All</Link>
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="flex h-[200px] items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No recent activity to display
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Overview</CardTitle>
            <CardDescription>
              Last 7 days attendance trend
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {attendanceChartData.some(d => d.present > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Bar dataKey="present" name="Present" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed">
                  <p className="text-muted-foreground">
                    No attendance data for the last 7 days
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Role Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Workforce Distribution</CardTitle>
            <CardDescription>
              Employees by role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {roleChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {roleChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed">
                  <p className="text-muted-foreground">
                    No employees to display
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
