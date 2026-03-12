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
  UserX,
  Wallet,
  AlertCircle,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { ROUTES } from "@/constants";
import { formatCurrency, cn } from "@/lib/utils";
import { formatDate, formatWeekRange } from "@/lib/date-utils";

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

// Mock data for demonstration
const mockStats = {
  totalEmployees: 156,
  activeEmployees: 142,
  totalSites: 12,
  activeSites: 8,
  todayPresent: 128,
  todayAbsent: 14,
  onLeave: 14,
  pendingAdvances: 5,
  pendingLoans: 2,
  weeklyPayroll: 485000,
};

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

// Recent activity mock data
const recentActivities = [
  {
    id: 1,
    type: "attendance",
    message: "Supervisor John marked attendance for 12 employees",
    time: "10 minutes ago",
  },
  {
    id: 2,
    type: "advance",
    message: "Advance request of ₹5,000 from Rahul Kumar",
    time: "1 hour ago",
  },
  {
    id: 3,
    type: "payroll",
    message: "Weekly payroll generated for Week 51",
    time: "2 hours ago",
  },
  {
    id: 4,
    type: "employee",
    message: "New employee Suresh added to Site Alpha",
    time: "3 hours ago",
  },
  {
    id: 5,
    type: "site",
    message: "Site Beta marked as completed",
    time: "5 hours ago",
  },
];

export default function DashboardPage() {
  const { profile } = useAuth();

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
          value={mockStats.totalEmployees}
          description={`${mockStats.activeEmployees} active`}
          icon={Users}
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title="Present Today"
          value={mockStats.todayPresent}
          description={`${mockStats.todayAbsent} absent, ${mockStats.onLeave} on leave`}
          icon={UserCheck}
          iconClassName="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          title="Active Sites"
          value={mockStats.activeSites}
          description={`of ${mockStats.totalSites} total sites`}
          icon={MapPin}
          iconClassName="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        />
        <StatCard
          title="Weekly Payroll"
          value={formatCurrency(mockStats.weeklyPayroll)}
          description={formatWeekRange()}
          icon={DollarSign}
          iconClassName="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        />
      </div>

      {/* Pending items alert */}
      {(mockStats.pendingAdvances > 0 || mockStats.pendingLoans > 0) && (
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
                {mockStats.pendingAdvances} advance requests and {mockStats.pendingLoans} loan requests need your attention
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
              <div className="divide-y">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Attendance overview chart placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Overview</CardTitle>
          <CardDescription>
            Weekly attendance trends across all sites
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">
              Chart will be displayed here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
