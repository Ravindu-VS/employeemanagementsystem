'use client';

import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { getSite, updateSite, getEmployeesByRole } from '@/services';
import { ROUTES, SITE_STATUSES } from '@/constants';
import { SiteStatus, UserProfile } from '@/types';
import { 
  ArrowLeft, 
  Save, 
  MapPin, 
  Building2,
  Target,
  Users,
  Loader2,
  AlertCircle
} from 'lucide-react';

// Validation schema
const siteSchema = z.object({
  name: z.string().min(2, 'Site name must be at least 2 characters'),
  code: z.string().min(2, 'Site code must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  latitude: z.number().min(-90).max(90, 'Invalid latitude'),
  longitude: z.number().min(-180).max(180, 'Invalid longitude'),
  geofenceRadius: z.number().min(10, 'Minimum radius is 10 meters').max(1000, 'Maximum radius is 1000 meters'),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const),
  clientName: z.string().optional(),
  clientContact: z.string().optional(),
  supervisorIds: z.array(z.string()).optional(),
});

type SiteFormData = z.infer<typeof siteSchema>;

export default function EditSitePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const siteId = params.id as string;

  // Fetch site details
  const { data: site, isLoading: siteLoading } = useQuery({
    queryKey: ['site', siteId],
    queryFn: () => getSite(siteId),
    enabled: !!siteId,
  });

  // Fetch supervisors for assignment
  const { data: supervisors = [] } = useQuery({
    queryKey: ['supervisors'],
    queryFn: () => getEmployeesByRole('supervisor'),
  });

  const form = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
    values: site ? {
      name: site.name,
      code: site.code,
      address: site.address,
      latitude: site.location?.latitude || 0,
      longitude: site.location?.longitude || 0,
      geofenceRadius: site.geofenceRadius,
      status: site.status,
      clientName: site.clientName || '',
      clientContact: site.clientContact || '',
      supervisorIds: site.supervisorIds || [],
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: SiteFormData) => updateSite(siteId, {
      ...data,
      location: { latitude: data.latitude, longitude: data.longitude },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      toast({
        title: 'Success',
        description: 'Site updated successfully',
      });
      router.push(ROUTES.SITES.DETAIL(siteId));
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update site',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: SiteFormData) => {
    updateMutation.mutate(data);
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          form.setValue('latitude', position.coords.latitude);
          form.setValue('longitude', position.coords.longitude);
          toast({
            title: 'Location Updated',
            description: 'GPS coordinates have been updated',
          });
        },
        (error) => {
          toast({
            title: 'Location Error',
            description: error.message,
            variant: 'destructive',
          });
        }
      );
    } else {
      toast({
        title: 'Not Supported',
        description: 'Geolocation is not supported by this browser',
        variant: 'destructive',
      });
    }
  };

  const toggleSupervisor = (supervisorId: string) => {
    const current = form.getValues('supervisorIds') || [];
    if (current.includes(supervisorId)) {
      form.setValue('supervisorIds', current.filter((id: string) => id !== supervisorId));
    } else {
      form.setValue('supervisorIds', [...current, supervisorId]);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push(ROUTES.SITES.DETAIL(siteId))}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Site</h1>
          <p className="text-muted-foreground">Update site information for {site.name}</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>Site name, code, and description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Site Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter site name"
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Site Code *</Label>
                <Input
                  id="code"
                  placeholder="e.g., SITE-001"
                  {...form.register('code')}
                />
                {form.formState.errors.code && (
                  <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <select
                id="status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...form.register('status')}
              >
                {SITE_STATUSES.map((option: { value: string; label: string; color: string }) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  placeholder="Enter client name"
                  {...form.register('clientName')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientContact">Client Contact</Label>
                <Input
                  id="clientContact"
                  placeholder="Enter client phone"
                  {...form.register('clientContact')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location & Geofence */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location & Geofence
            </CardTitle>
            <CardDescription>GPS coordinates and geofence settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                placeholder="Enter full address"
                {...form.register('address')}
              />
              {form.formState.errors.address && (
                <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude *</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="e.g., 6.9271"
                  {...form.register('latitude', { valueAsNumber: true })}
                />
                {form.formState.errors.latitude && (
                  <p className="text-sm text-destructive">{form.formState.errors.latitude.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude *</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="e.g., 79.8612"
                  {...form.register('longitude', { valueAsNumber: true })}
                />
                {form.formState.errors.longitude && (
                  <p className="text-sm text-destructive">{form.formState.errors.longitude.message}</p>
                )}
              </div>
            </div>

            <Button type="button" variant="outline" onClick={handleGetCurrentLocation}>
              <MapPin className="h-4 w-4 mr-2" />
              Use Current Location
            </Button>

            <div className="space-y-2">
              <Label htmlFor="geofenceRadius" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Geofence Radius (meters) *
              </Label>
              <Input
                id="geofenceRadius"
                type="number"
                min={10}
                max={1000}
                placeholder="e.g., 100"
                {...form.register('geofenceRadius', { valueAsNumber: true })}
              />
              {form.formState.errors.geofenceRadius && (
                <p className="text-sm text-destructive">{form.formState.errors.geofenceRadius.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Employees must be within this radius to check in/out
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Supervisors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assigned Supervisors
            </CardTitle>
            <CardDescription>Select supervisors responsible for this site</CardDescription>
          </CardHeader>
          <CardContent>
            {supervisors.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {supervisors.map((supervisor: UserProfile) => {
                  const isSelected = form.watch('supervisorIds')?.includes(supervisor.uid);
                  return (
                    <div
                      key={supervisor.uid}
                      onClick={() => toggleSupervisor(supervisor.uid)}
                      className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all
                        ${isSelected 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-primary/50'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                          ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                        `}>
                          {(supervisor.displayName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{supervisor.displayName || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{supervisor.phone}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No supervisors available. Add supervisors in the Employees section first.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(ROUTES.SITES.DETAIL(siteId))}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
