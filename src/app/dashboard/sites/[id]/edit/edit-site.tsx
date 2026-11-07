'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, 
  Save, 
  Building2,
  MapPin,
  User,
  Phone,
  Target,
  Loader2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getSite, updateSite } from '@/services';
import { createAuditLog } from '@/services/audit-service';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { ROUTES } from '@/constants';

// Form validation schema
const siteSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  clientName: z.string().optional(),
  clientContact: z.string().optional(),
  description: z.string().optional(),
  enableGeofence: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radius: z.number().min(10, 'Radius must be at least 10 meters').max(1000, 'Radius must be 1000 meters or less').optional(),
});

type SiteFormData = z.infer<typeof siteSchema>;

export default function EditSitePage() {
  const params = useParams();
  const siteId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthorized, user, profile } = useRequireRole(['owner', 'ceo', 'manager']);
  const [enableGeofence, setEnableGeofence] = useState(false);

  // Fetch site details
  const { data: site, isLoading: siteLoading } = useQuery({
    queryKey: ['site', siteId],
    queryFn: () => getSite(siteId),
    enabled: !!siteId,
  });

  const isSiteReadOnly = site?.status === 'completed';

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
  });

  useEffect(() => {
    if (site) {
      const hasGeofence = !!(site.location?.latitude && site.location?.longitude);
      setEnableGeofence(hasGeofence);
      reset({
        name: site.name || '',
        address: site.address || '',
        clientName: site.clientName || '',
        clientContact: site.clientContact || '',
        description: (site as any).description || '',
        enableGeofence: hasGeofence,
        latitude: site.location?.latitude || 0,
        longitude: site.location?.longitude || 0,
        radius: site.geofenceRadius || 100,
      });
    }
  }, [site, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: SiteFormData) => {
      const siteData = {
        name: data.name,
        address: data.address,
        location: {
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
        },
        geofenceRadius: data.radius || 100,
        clientName: data.clientName,
        clientContact: data.clientContact,
      };

      await updateSite(siteId, siteData);

      if (profile) {
        createAuditLog({
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role!,
          action: 'update',
          resource: 'sites',
          resourceId: siteId,
          newValue: { name: data.name },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      toast({
        title: 'Site Updated',
        description: 'Site has been updated successfully.',
      });
      router.push(ROUTES.SITES.DETAIL(siteId));
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update site',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: SiteFormData) => {
    updateMutation.mutate(data);
  };

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setValue('latitude', position.coords.latitude);
          setValue('longitude', position.coords.longitude);
          toast({
            title: 'Location Retrieved',
            description: 'Current location has been set as the geofence center.',
          });
        },
        (error) => {
          toast({
            title: 'Location Error',
            description: 'Unable to get current location. Please enter manually.',
            variant: 'destructive',
          });
        }
      );
    } else {
      toast({
        title: 'Not Supported',
        description: 'Geolocation is not supported in this browser.',
        variant: 'destructive',
      });
    }
  };

  if (!isAuthorized) {
    return null;
  }

  if (siteLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
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
      {isSiteReadOnly && (
        <Card className="border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <p className="text-sm font-medium">
              This site is completed and is in Read-Only mode. Site properties cannot be modified.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={ROUTES.SITES.LIST}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Site</h1>
          <p className="text-muted-foreground">
            Update work site or project location details
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Information */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Site Information
              </CardTitle>
              <CardDescription>
                Basic details about the work site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" required>Site Name</Label>
                  <Input
                    id="name"
                    placeholder="Downtown Tower Project"
                    disabled={isSiteReadOnly}
                    {...register('name')}
                    error={errors.name?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Site Code</Label>
                  <Input
                    id="code"
                    value={site.code || ''}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" required>Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street, City, State"
                  icon={<MapPin className="h-4 w-4" />}
                  disabled={isSiteReadOnly}
                  {...register('address')}
                  error={errors.address?.message}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  placeholder="Additional details about the site..."
                  disabled={isSiteReadOnly}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register('description')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Client Information */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Client Information
              </CardTitle>
              <CardDescription>
                Client or project owner details (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  placeholder="ABC Construction Ltd."
                  icon={<User className="h-4 w-4" />}
                  disabled={isSiteReadOnly}
                  {...register('clientName')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientContact">Client Contact</Label>
                <Input
                  id="clientContact"
                  placeholder="+94 77 123 4567"
                  icon={<Phone className="h-4 w-4" />}
                  disabled={isSiteReadOnly}
                  {...register('clientContact')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Geofence Settings */}
          <Card className="bg-card/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Geofence Settings
              </CardTitle>
              <CardDescription>
                Configure location-based attendance tracking for this site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enableGeofence"
                  checked={enableGeofence}
                  disabled={isSiteReadOnly}
                  onChange={(e) => setEnableGeofence(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Label htmlFor="enableGeofence" className="cursor-pointer">
                  Enable geofence for this site
                </Label>
              </div>

              {enableGeofence && (
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Set the center point and radius for the geofence
                    </p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={getCurrentLocation}
                      disabled={isSiteReadOnly}
                      className="gap-2"
                    >
                      <MapPin className="h-4 w-4" />
                      Use Current Location
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        placeholder="6.9271"
                        disabled={isSiteReadOnly}
                        {...register('latitude', { valueAsNumber: true })}
                        error={errors.latitude?.message}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        placeholder="79.8612"
                        disabled={isSiteReadOnly}
                        {...register('longitude', { valueAsNumber: true })}
                        error={errors.longitude?.message}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="radius">Radius (meters)</Label>
                      <Input
                        id="radius"
                        type="number"
                        placeholder="100"
                        disabled={isSiteReadOnly}
                        {...register('radius', { valueAsNumber: true })}
                        error={errors.radius?.message}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Employees must be within this radius to mark attendance for this site.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Link href={ROUTES.SITES.LIST}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={updateMutation.isPending || isSiteReadOnly} className="gap-2">
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Update Site
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
