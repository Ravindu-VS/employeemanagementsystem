'use client';

/**
 * =====================================================
 * CREATE SITE PAGE
 * =====================================================
 * Form to add a new work site to the system.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
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
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createSite } from '@/services';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { ROUTES } from '@/constants';

// Form validation schema
const siteSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(10, 'Code must be 10 characters or less'),
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

export default function CreateSitePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthorized, user } = useRequireRole(['owner', 'ceo', 'manager']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enableGeofence, setEnableGeofence] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      radius: 100,
    },
  });

  const onSubmit = async (data: SiteFormData) => {
    setIsSubmitting(true);
    try {
      const siteData = {
        name: data.name,
        code: data.code.toUpperCase(),
        address: data.address,
        city: '',
        state: '',
        pincode: '',
        location: {
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
        },
        geofenceRadius: data.radius || 100,
        isActive: true,
        supervisorIds: [] as string[],
        startDate: new Date(),
        projectType: 'construction',
        status: 'planning' as const,
        clientName: data.clientName,
        clientContact: data.clientContact,
        createdBy: user?.uid || '',
      };

      await createSite(siteData);

      toast({
        title: 'Site Created',
        description: `${data.name} has been added successfully.`,
      });

      router.push(ROUTES.SITES.LIST);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create site',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={ROUTES.SITES.LIST}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Site</h1>
          <p className="text-muted-foreground">
            Create a new work site or project location
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
                    {...register('name')}
                    error={errors.name?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code" required>Site Code</Label>
                  <Input
                    id="code"
                    placeholder="DTP001"
                    maxLength={10}
                    {...register('code')}
                    error={errors.code?.message}
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier (max 10 characters)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" required>Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street, City, State"
                  icon={<MapPin className="h-4 w-4" />}
                  {...register('address')}
                  error={errors.address?.message}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  placeholder="Additional details about the site..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  {...register('clientName')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientContact">Client Contact</Label>
                <Input
                  id="clientContact"
                  placeholder="+94 77 123 4567"
                  icon={<Phone className="h-4 w-4" />}
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
                  onChange={(e) => setEnableGeofence(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
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
                        {...register('radius', { valueAsNumber: true })}
                        error={errors.radius?.message}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Employees must be within this radius to mark attendance for this site.
                    Default radius is 100 meters.
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
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Create Site
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
