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
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: SiteStatus) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'on_hold':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push(ROUTES.SITES.LIST)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{site.name}</h1>
              <Badge className={getStatusColor(site.status)}>
                {getStatusIcon(site.status)}
                <span className="ml-1">{getStatusLabel(site.status)}</span>
              </Badge>
            </div>
            <p className="text-muted-foreground">{site.code}</p>
          </div>
        </div>
        <Button onClick={() => router.push(ROUTES.SITES.EDIT(siteId))}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Site
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Supervisors</p>
                <p className="text-2xl font-bold">{site.supervisorIds?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Target className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Geofence Radius</p>
                <p className="text-2xl font-bold">{site.geofenceRadius}m</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-lg font-bold">{formatDate(site.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Clock className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Updated</p>
                <p className="text-lg font-bold">{formatDate(site.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Location Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Details
            </CardTitle>
            <CardDescription>Site address and GPS coordinates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Address</label>
              <p className="font-medium">{site.address}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Latitude</label>
                <p className="font-medium font-mono">{site.location?.latitude?.toFixed(6) || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Longitude</label>
                <p className="font-medium font-mono">{site.location?.longitude?.toFixed(6) || '-'}</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Geofence Radius</label>
              <p className="font-medium">{site.geofenceRadius} meters</p>
            </div>

            {/* Map Placeholder */}
            <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Map view coming soon</p>
                <p className="text-xs mt-1">
                  {site.location?.latitude?.toFixed(6) || '-'}, {site.location?.longitude?.toFixed(6) || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Site Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Site Information
            </CardTitle>
            <CardDescription>General site details and contacts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Site Name</label>
              <p className="font-medium">{site.name}</p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Site Code</label>
              <p className="font-medium font-mono">{site.code}</p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge className={getStatusColor(site.status)}>
                  {getStatusIcon(site.status)}
                  <span className="ml-1">{getStatusLabel(site.status)}</span>
                </Badge>
              </div>
            </div>

            {site.clientName && (
              <div>
                <label className="text-sm text-muted-foreground">Client Name</label>
                <p className="font-medium">{site.clientName}</p>
              </div>
            )}

            {site.clientContact && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm text-muted-foreground">Client Contact</label>
                  <p className="font-medium">{site.clientContact}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Supervisors */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assigned Supervisors
            </CardTitle>
            <CardDescription>
              Supervisors responsible for this site
            </CardDescription>
          </CardHeader>
          <CardContent>
            {supervisorNames.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {supervisorNames.map((name, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg"
                  >
                    <div className="p-2 bg-primary/10 rounded-full">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">Supervisor</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No supervisors assigned to this site</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push(ROUTES.SITES.EDIT(siteId))}
                >
                  Assign Supervisors
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
