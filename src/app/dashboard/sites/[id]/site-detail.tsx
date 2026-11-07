'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getSite, getAllEmployees } from '@/services';
import { ROUTES, SITE_STATUSES } from '@/constants';
import { formatDate } from '@/lib/date-utils';
import type { UserProfile, SiteStatus } from '@/types';
import { 
  ArrowLeft, 
  Edit, 
  MapPin, 
  Users, 
  Calendar, 
  Clock,
  Target,
  Building2,
  Phone,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;

  // Fetch site details
  const { data: site, isLoading: siteLoading } = useQuery({
    queryKey: ['site', siteId],
    queryFn: () => getSite(siteId),
    enabled: !!siteId,
  });

  // Fetch all employees to get supervisor details
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => getAllEmployees(),
  });

  if (siteLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Site not found</h2>
        <Button onClick={() => router.push(ROUTES.SITES.LIST)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sites
        </Button>
      </div>
    );
  }

  // Get supervisor names
  const supervisorNames = site.supervisorIds
    ?.map((supId: string) => employees.find((e: UserProfile) => e.uid === supId)?.displayName)
    .filter(Boolean) || [];

  const getStatusLabel = (status: SiteStatus) => {
    const found = SITE_STATUSES.find(s => s.value === status);
    return found?.label || status;
  };

  const getStatusColor = (status: SiteStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'planning':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'completed':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'on_hold':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'inactive':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'archived':
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {site.status === 'completed' && (
        <Card className="border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <p className="text-sm font-medium">
              This site is completed and is in Read-Only mode. Details cannot be edited.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(ROUTES.SITES.LIST)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{site.name}</h1>
            <p className="text-muted-foreground">{site.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(site.status)}>{getStatusLabel(site.status)}</Badge>
          <Button onClick={() => router.push(ROUTES.SITES.EDIT(siteId))}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Location Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Address</p>
                <p className="text-sm text-muted-foreground">{site.address}</p>
              </div>
            </div>
            {site.location?.latitude && site.location?.longitude && (
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Geofence (Radius: {site.geofenceRadius}m)</p>
                  <p className="text-sm text-muted-foreground">
                    {site.location.latitude.toFixed(4)}, {site.location.longitude.toFixed(4)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Client Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Client Name</p>
                <p className="text-sm text-muted-foreground">{site.clientName || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Contact</p>
                <p className="text-sm text-muted-foreground">{site.clientContact || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {(site as any).description && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{(site as any).description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
