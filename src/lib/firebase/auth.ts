/**
 * =====================================================
 * FIREBASE AUTH UTILITIES
 * =====================================================
 * Authentication helper functions for the client side.
 */

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, limit } from 'firebase/firestore';
import { auth, db } from './config';
import { COLLECTIONS } from '@/constants';
import type { User, UserProfile } from '@/types';

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Check if we're in a browser
const isBrowser = typeof window !== 'undefined';

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ user: FirebaseUser; profile: UserProfile }> {
  try {
    // Sign in with Firebase Auth
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = credential.user;
    
    // Fetch user profile from Firestore
    const profile = await getUserProfile(firebaseUser.uid);
    
    if (!profile) {
      throw new Error('User profile not found. Please contact administrator.');
    }
    
    if (!profile.isActive) {
      // Sign out inactive users
      await firebaseSignOut(auth);
      throw new Error('Your account has been deactivated. Please contact administrator.');
    }
    
    // Update last login
    await updateLastLogin(firebaseUser.uid);
    
    return { user: firebaseUser, profile };
  } catch (error: any) {
    // Map Firebase error codes to user-friendly messages
    const errorMessage = mapAuthError(error.code || error.message);
    throw new Error(errorMessage);
  }
}

/**
 * Create user profile in Firestore
 */
async function createUserProfile(firebaseUser: FirebaseUser): Promise<{ profile: UserProfile; isNewUser: boolean }> {
  // Check if user profile exists
  let profile = await getUserProfile(firebaseUser.uid);
  let isNewUser = false;
  
  if (!profile) {
    // Check if this is the first user (will be owner)
    let isFirstUser = false;
    try {
      const usersQuery = query(collection(db, COLLECTIONS.USERS), limit(1));
      const snapshot = await getDocs(usersQuery);
      isFirstUser = snapshot.empty;
    } catch (e) {
      console.warn('Could not check if first user, assuming not first:', e);
      isFirstUser = false;
    }
    
    // Create new user profile
    const newProfile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || 'User',
      photoURL: firebaseUser.photoURL,
      workerId: '',
      phone: firebaseUser.phoneNumber || '',
      role: isFirstUser ? 'owner' : 'helper',
      isActive: isFirstUser, // First user is active, others need approval
      joiningDate: new Date(),
      assignedSites: [],
      dailyRate: 0,
      otRate: 0,
      hourlyRate: 0,
      weeklyRate: 0,
      documents: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        loginCount: 1,
        lastLoginAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    try {
      await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), newProfile);
      profile = newProfile as unknown as UserProfile;
      isNewUser = true;
    } catch (e: any) {
      console.error('Failed to create user profile:', e);
      // Check if it's a permission error
      if (e.code === 'permission-denied' || e.message?.includes('offline')) {
        throw new Error('Database access denied. Please ask the administrator to configure Firestore security rules.');
      }
      throw new Error('Failed to create user profile. Please try again.');
    }
  } else {
    // Existing user - check if active
    if (!profile.isActive) {
      await firebaseSignOut(auth);
      throw new Error('Your account is pending approval or has been deactivated. Please contact administrator.');
    }
    
    // Update last login
    await updateLastLogin(firebaseUser.uid);
  }
  
  return { profile, isNewUser };
}

/**
 * Sign in or sign up with Google
 */
export async function signInWithGoogle(): Promise<{ user: FirebaseUser; profile: UserProfile; isNewUser: boolean }> {
  try {
    // Use popup for Google sign-in
    const credential = await signInWithPopup(auth, googleProvider);
    const firebaseUser = credential.user;
    
    const { profile, isNewUser } = await createUserProfile(firebaseUser);
    
    return { user: firebaseUser, profile, isNewUser };
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled. Please try again.');
    }
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this site.');
    }
    if (error.message?.includes('offline') || error.message?.includes('Database access denied')) {
      throw error; // Re-throw our custom errors
    }
    const errorMessage = mapAuthError(error.code || error.message);
    throw new Error(errorMessage);
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    throw new Error('Failed to sign out. Please try again.');
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    const errorMessage = mapAuthError(error.code || error.message);
    throw new Error(errorMessage);
  }
}

/**
 * Change password for authenticated user
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;
  
  if (!user || !user.email) {
    throw new Error('No authenticated user found.');
  }
  
  try {
    // Re-authenticate user first
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Update password
    await updatePassword(user, newPassword);
  } catch (error: any) {
    const errorMessage = mapAuthError(error.code || error.message);
    throw new Error(errorMessage);
  }
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, COLLECTIONS.USERS, uid);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = docSnap.data();
    
    return {
      uid: docSnap.id,
      ...data,
      // Handle both isActive boolean and status string (legacy)
      isActive: data.isActive ?? (data.status === 'active'),
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      joiningDate: data.joiningDate?.toDate?.() || data.joiningDate,
      dateOfBirth: data.dateOfBirth?.toDate?.() || data.dateOfBirth,
    } as UserProfile;
  } catch (error: any) {
    console.error('Failed to fetch user profile:', error);
    // Check for specific Firestore errors
    if (error.message?.includes('offline') || error.code === 'unavailable') {
      console.error('Firestore appears to be offline. This usually means security rules are blocking access.');
    }
    return null;
  }
}

/**
 * Update user's last login timestamp
 */
async function updateLastLogin(uid: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(docRef, {
      'metadata.lastLoginAt': serverTimestamp(),
      'metadata.loginCount': increment(1),
    });
  } catch (error) {
    // Non-critical error, just log it
    console.warn('Failed to update last login:', error);
  }
}

// Helper for Firestore increment
import { increment } from 'firebase/firestore';

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

/**
 * Map Firebase auth error codes to user-friendly messages
 */
function mapAuthError(code: string): string {
  const errorMap: Record<string, string> = {
    'auth/invalid-email': 'Invalid email address format.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password is too weak. Use at least 8 characters.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/requires-recent-login': 'Please log in again to perform this action.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed.',
  };
  
  return errorMap[code] || 'An unexpected error occurred. Please try again.';
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Check if user has permission
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  return userPermissions.includes('all') || userPermissions.includes(requiredPermission);
}
