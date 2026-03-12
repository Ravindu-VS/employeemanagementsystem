"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { getUserProfile } from "@/lib/firebase/auth";
import { useAuthStore } from "@/store/auth-store";
import type { UserProfile, AuthStatus } from "@/types";
import { ROUTES } from "@/constants";

/**
 * Auth Provider
 * Handles Firebase auth state synchronization with the app
 */

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  status: AuthStatus;
  isAdmin: boolean;
  isSupervisor: boolean;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  ROUTES.HOME,
  ROUTES.LOGIN,
  ROUTES.SIGNUP,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
];

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { 
    user, 
    profile, 
    status, 
    setUser, 
    setProfile, 
    setStatus, 
    reset 
  } = useAuthStore();

  // Derived state
  const isAdmin = React.useMemo(() => {
    if (!profile) return false;
    return ['owner', 'ceo', 'manager'].includes(profile.role);
  }, [profile]);

  const isSupervisor = React.useMemo(() => {
    if (!profile) return false;
    return profile.role === 'supervisor';
  }, [profile]);

  // Subscribe to auth state changes
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Fetch user profile from Firestore with retry
        const fetchProfileWithRetry = async (retries = 3): Promise<any> => {
          for (let i = 0; i < retries; i++) {
            try {
              const profile = await getUserProfile(firebaseUser.uid);
              return profile;
            } catch (error: any) {
              console.warn(`Profile fetch attempt ${i + 1} failed:`, error.message);
              if (i < retries - 1) {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
              }
            }
          }
          return null;
        };
        
        try {
          const userProfile = await fetchProfileWithRetry();
          
          if (userProfile) {
            if (!userProfile.isActive) {
              // User account is deactivated
              await auth.signOut();
              reset();
              router.push(ROUTES.LOGIN + '?error=account_deactivated');
              return;
            }
            
            setProfile(userProfile);
            setStatus('authenticated');
          } else {
            // No profile found - likely Firestore rules blocking or new user
            console.warn('No profile found for user:', firebaseUser.uid);
            // Keep user signed in but set as unauthenticated in app
            // so they can retry after rules are configured
            reset();
            router.push(ROUTES.LOGIN + '?error=no_profile');
          }
        } catch (error: any) {
          console.error('Error fetching user profile:', error);
          reset();
          if (error.message?.includes('offline') || error.message?.includes('Database access denied')) {
            router.push(ROUTES.LOGIN + '?error=firestore_offline');
          } else {
            router.push(ROUTES.LOGIN + '?error=profile_fetch_failed');
          }
        }
      } else {
        // User signed out
        reset();
      }
    });

    return () => unsubscribe();
  }, [setUser, setProfile, setStatus, reset, router]);

  // Handle route protection
  React.useEffect(() => {
    if (status === 'loading') return;

    const isPublicRoute = PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    );

    if (status === 'unauthenticated' && !isPublicRoute) {
      // Redirect to login if trying to access protected route
      router.push(ROUTES.LOGIN + `?redirect=${encodeURIComponent(pathname)}`);
    }

    if (status === 'authenticated' && pathname === ROUTES.LOGIN) {
      // Redirect to dashboard if already logged in
      router.push(ROUTES.DASHBOARD);
    }
  }, [status, pathname, router]);

  const contextValue = React.useMemo(
    () => ({
      user,
      profile,
      status,
      isAdmin,
      isSupervisor,
    }),
    [user, profile, status, isAdmin, isSupervisor]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = React.useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth() {
  const { status, profile } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(ROUTES.LOGIN);
    }
  }, [status, router]);

  return { status, profile, isLoading: status === 'loading' };
}

/**
 * Hook to check if user has required role
 */
export function useRequireRole(requiredRoles: string[]) {
  const { profile, status, user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'authenticated' && profile) {
      if (!requiredRoles.includes(profile.role)) {
        router.push(ROUTES.DASHBOARD);
      }
    }
  }, [profile, status, requiredRoles, router]);

  const hasAccess = profile ? requiredRoles.includes(profile.role) : false;

  return { hasAccess, isAuthorized: hasAccess, isLoading: status === 'loading', user, profile };
}
