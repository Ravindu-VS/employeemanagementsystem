import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile, AuthStatus } from '@/types';
import { STORAGE_KEYS } from '@/constants';

/**
 * Auth Store
 * Global state management for authentication using Zustand
 */

interface AuthState {
  // State
  user: FirebaseUser | null;
  profile: UserProfile | null;
  status: AuthStatus;
  
  // Actions
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setStatus: (status: AuthStatus) => void;
  reset: () => void;
}

// Initial state
const initialState = {
  user: null,
  profile: null,
  status: 'loading' as AuthStatus,
};

/**
 * Auth store with persistence
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,
      
      setUser: (user) => set({ user }),
      
      setProfile: (profile) => set({ profile }),
      
      setStatus: (status) => set({ status }),
      
      reset: () => set({ 
        ...initialState, 
        status: 'unauthenticated' 
      }),
    }),
    {
      name: STORAGE_KEYS.USER_DATA,
      // Only persist profile, not Firebase user object
      partialize: (state) => ({
        profile: state.profile,
      }),
    }
  )
);

/**
 * Selectors for optimized re-renders
 */
export const selectUser = (state: AuthState) => state.user;
export const selectProfile = (state: AuthState) => state.profile;
export const selectStatus = (state: AuthState) => state.status;
export const selectIsAuthenticated = (state: AuthState) => 
  state.status === 'authenticated';
export const selectIsLoading = (state: AuthState) => 
  state.status === 'loading';
