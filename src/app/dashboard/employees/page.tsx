'use client';

/**
 * =====================================================
 * EMPLOYEES LIST PAGE
 * =====================================================
 * Displays all employees with filtering and search.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  UserX,
  UserCheck,
  ChevronDown,
  Users,
  Building2,
  Phone,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllEmployees, deactivateEmployee, reactivateEmployee } from '@/services';
import { useRequireRole } from '@/components/providers/auth-provider';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { ROUTES, USER_ROLES } from '@/constants';
import type { UserProfile, UserRole } from '@/types';

// Role badge colors
const roleBadgeColors: Record<UserRole, string> = {
  owner: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ceo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  manager: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  supervisor: 'bg-green-500/20 text-green-400 border-green-500/30',
  draughtsman: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  bass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  helper: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function EmployeesPage() {
  const { isAuthorized } = useRequireRole(['owner', 'ceo', 'manager']);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch employees
  const { 
    data: employees = [], 
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['employees'],
    queryFn: getAllEmployees,
  });

  // Filter employees
  const filteredEmployees = employees.filter((employee) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        (employee.displayName || '').toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.phone?.includes(query) ||
        employee.workerId?.toLowerCase().includes(query);
      
      if (!matchesSearch) return false;
    }

    // Role filter
    if (roleFilter !== 'all' && employee.role !== roleFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'active' && !employee.isActive) {
      return false;
    }
    if (statusFilter === 'inactive' && employee.isActive) {
      return false;
    }

    return true;
  });

  // Group by role for stats
  const roleStats = employees.reduce((acc, emp) => {
    acc[emp.role] = (acc[emp.role] || 0) + 1;
    return acc;
  }, {} as Record<UserRole, number>);

  const activeCount = employees.filter(e => e.isActive).length;
  const inactiveCount = employees.filter(e => !e.isActive).length;

  const handleToggleStatus = async (employee: UserProfile) => {
    try {
      if (employee.isActive) {
        await deactivateEmployee(employee.uid);
      } else {
        await reactivateEmployee(employee.uid);
      }
      refetch();
    } catch (error) {
      console.error('Error toggling employee status:', error);
    }
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground">
            Manage your workforce and employee records
          </p>
        </div>
        <Link href={ROUTES.EMPLOYEES.CREATE}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{employees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/20 p-2">
                <UserCheck className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/20 p-2">
                <UserX className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold">{inactiveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/20 p-2">
                <Building2 className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Roles</p>
                <p className="text-2xl font-bold">{Object.keys(roleStats).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="bg-card/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filters
              <ChevronDown className={cn(
                'h-4 w-4 transition-transform',
                showFilters && 'rotate-180'
              )} />
            </Button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All Roles</option>
                  {Object.entries(USER_ROLES).map(([key, role]) => (
                    <option key={key} value={key}>{role.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card className="bg-card/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Users className="h-12 w-12" />
              <p>No employees found</p>
              {searchQuery && (
                <Button variant="ghost" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-4 font-medium text-muted-foreground">Employee</th>
                    <th className="p-4 font-medium text-muted-foreground">Role</th>
                    <th className="p-4 font-medium text-muted-foreground">Contact</th>
                    <th className="p-4 font-medium text-muted-foreground">Daily Rate</th>
                    <th className="p-4 font-medium text-muted-foreground">Status</th>
                    <th className="p-4 font-medium text-muted-foreground">Joined</th>
                    <th className="p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr 
                      key={employee.uid} 
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
                            {(employee.displayName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{employee.displayName || 'Unnamed'}</p>
                            <p className="text-sm text-muted-foreground">
                              {employee.workerId || 'No ID'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
                          roleBadgeColors[employee.role]
                        )}>
                          {USER_ROLES[employee.role]?.label || employee.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[150px]">{employee.email}</span>
                          </div>
                          {employee.phone && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {employee.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium">
                          LKR {employee.dailyRate?.toLocaleString() || '0'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          employee.isActive 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        )}>
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            employee.isActive ? 'bg-green-400' : 'bg-red-400'
                          )} />
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatDate(employee.joiningDate || employee.createdAt)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Link href={ROUTES.EMPLOYEES.DETAIL(employee.uid)}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={ROUTES.EMPLOYEES.EDIT(employee.uid)}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => handleToggleStatus(employee)}
                          >
                            {employee.isActive ? (
                              <UserX className="h-4 w-4 text-red-400" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-green-400" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Info */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredEmployees.length} of {employees.length} employees
      </div>
    </div>
  );
}
