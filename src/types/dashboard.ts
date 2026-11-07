/**
 * =====================================================
 * DASHBOARD STATS TYPES
 * =====================================================
 */

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalSites: number;
  activeSites: number;
  todayPresent: number;
  todayAbsent: number;
  pendingAdvances: number;
  pendingLoans: number;
  weeklyPayrollTotal: number;
  recentActivities: RecentActivity[];
}

export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  userId: string;
  userName: string;
  timestamp: Date;
}
