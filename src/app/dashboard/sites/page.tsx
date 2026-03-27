'use client';

/**
 * =====================================================
 * SITES LIST PAGE
 * =====================================================
 * Displays all work sites with filtering and management.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Filter,
  Eye,
  Edit,
  Trash2,
  MapPin,
  Building2,
  Users,
  ChevronDown,
  PlayCircle,
  PauseCircle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { getAllSites, updateSiteStatus, deleteSite } from '@/services';
import { createAuditLog } from '@/services/audit-service';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants';
import type { SiteStatus } from '@/types';

// Status badge configuration
const statusConfig: Record<SiteStatus, { 
  label: string; 
  color: string;
  icon: React.ReactNode;
}> = {
  active: {
    label: 'Active',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <PlayCircle className="h-3.5 w-3.5" />,
  },
  on_hold: {
    label: 'On Hold',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <PauseCircle className="h-3.5 w-3.5" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  planning: {
    label: 'Planning',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
};

export default function SitesPage() {
  const { isAuthorized, profile } = useRequireRole(['owner', 'ceo', 'manager']);
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SiteStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch sites
  const { 
    data: sites = [], 
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['sites'],
    queryFn: getAllSites,
  });

  // Filter sites
  const filteredSites = sites.filter((site) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        site.name.toLowerCase().includes(query) ||
        site.code.toLowerCase().includes(query) ||
        site.address.toLowerCase().includes(query) ||
        site.clientName?.toLowerCase().includes(query);
      
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && site.status !== statusFilter) {
      return false;
    }

    return true;
  });

  // Calculate stats
  const activeCount = sites.filter(s => s.status === 'active').length;
  const pausedCount = sites.filter(s => s.status === 'on_hold').length;
  const completedCount = sites.filter(s => s.status === 'completed').length;

  const handleStatusChange = async (siteId: string, newStatus: SiteStatus) => {
    try {
      await updateSiteStatus(siteId, newStatus);
      toast({
        title: 'Status Updated',
        description: `Site status changed to ${statusConfig[newStatus].label}`,
      });
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (siteId: string, siteName: string) => {
    if (!confirm(`Are you sure you want to delete "${siteName}"? This cannot be undone.`)) return;
    try {
      await deleteSite(siteId);
      if (profile) {
        createAuditLog({
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role,
          action: 'delete',
          resource: 'sites',
          resourceId: siteId,
          newValue: { name: siteName },
        });
      }
      toast({
        title: 'Site Deleted',
        description: `${siteName} has been removed.`,
      });
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete site',
        variant: 'destructive',
      });
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
          <h1 className="text-2xl font-bold text-foreground">Work Sites</h1>
          <p className="text-muted-foreground">
            Manage construction sites and project locations
          </p>
        </div>
        <Link href={ROUTES.SITES.CREATE}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Site
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <Building2 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sites</p>
                <p className="text-2xl font-bold">{sites.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/20 p-2">
                <PlayCircle className="h-5 w-5 text-green-400" />
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
              <div className="rounded-lg bg-yellow-500/20 p-2">
                <PauseCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paused</p>
                <p className="text-2xl font-bold">{pausedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/20 p-2">
                <CheckCircle className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completedCount}</p>
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
                placeholder="Search sites by name, code, address..."
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
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as SiteStatus | 'all')}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sites Grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredSites.length === 0 ? (
        <Card className="bg-card/50">
          <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Building2 className="h-12 w-12" />
            <p>No sites found</p>
            {searchQuery && (
              <Button variant="ghost" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSites.map((site) => (
            <Card key={site.id} className="bg-card/50 hover:bg-card/80 transition-colors">
              <CardContent className="p-5">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{site.name}</h3>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {site.code}
                        </span>
                      </div>
                      {site.clientName && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Client: {site.clientName}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                      statusConfig[site.status].color
                    )}>
                      {statusConfig[site.status].icon}
                      {statusConfig[site.status].label}
                    </span>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{site.address}</span>
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{site.supervisorIds?.length || 0} supervisors</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDate(site.createdAt)}</span>
                    </div>
                  </div>

                  {/* Geofence indicator */}
                  {site.geofenceRadius > 0 && (
                    <div className="flex items-center gap-2 rounded-md bg-blue-500/10 px-2 py-1.5 text-xs text-blue-400">
                      <MapPin className="h-3.5 w-3.5" />
                      Geofence enabled ({site.geofenceRadius}m radius)
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t border-border/50 pt-4">
                    <div className="flex gap-2">
                      <Link href={ROUTES.SITES.DETAIL(site.id)}>
                        <Button variant="ghost" size="sm" className="h-8 gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                      <Link href={ROUTES.SITES.EDIT(site.id)}>
                        <Button variant="ghost" size="sm" className="h-8 gap-1">
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </Link>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 gap-1 text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(site.id, site.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                    
                    {/* Quick status change */}
                    {site.status === 'active' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 gap-1 text-yellow-400 hover:text-yellow-300"
                        onClick={() => handleStatusChange(site.id, 'on_hold')}
                      >
                        <PauseCircle className="h-3.5 w-3.5" />
                        Pause
                      </Button>
                    )}
                    {site.status === 'on_hold' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 gap-1 text-green-400 hover:text-green-300"
                        onClick={() => handleStatusChange(site.id, 'active')}
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Resume
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results Info */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredSites.length} of {sites.length} sites
      </div>
    </div>
  );
}
