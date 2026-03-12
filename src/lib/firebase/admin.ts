/**
 * =====================================================
 * FIREBASE ADMIN CONFIGURATION
 * =====================================================
 * Server-side Firebase Admin SDK initialization.
 * Used for server-side operations with elevated privileges.
 * 
 * IMPORTANT: This file should ONLY be imported in:
 * - API routes (app/api/*)
 * - Server components
 * - Server actions
 * 
 * Never import this file in client components!
 */

import { initializeApp, getApps, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

// Service account credentials from environment variables
const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  // Handle newlines in private key (common issue with env vars)
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

// Validate configuration
function validateAdminConfig(): boolean {
  const requiredFields = ['projectId', 'clientEmail', 'privateKey'] as const;
  
  const missingFields = requiredFields.filter(
    (field) => !serviceAccount[field]
  );
  
  if (missingFields.length > 0) {
    console.error(
      `Firebase Admin config missing: ${missingFields.join(', ')}. ` +
      'Server-side Firebase operations will fail.'
    );
    return false;
  }
  
  return true;
}

// Initialize Firebase Admin app (singleton pattern)
function initializeAdminApp(): App | null {
  // Check if already initialized
  if (getApps().length > 0) {
    return getApps()[0];
  }
  
  // Validate configuration
  if (!validateAdminConfig()) {
    return null;
  }
  
  try {
    const app = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    
    console.log('✅ Firebase Admin initialized successfully');
    return app;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    return null;
  }
}

// Initialize admin app
const adminApp = initializeAdminApp();

// Get admin instances (with null checks)
function getAdminAuth(): Auth | null {
  if (!adminApp) return null;
  return getAuth(adminApp);
}

function getAdminFirestore(): Firestore | null {
  if (!adminApp) return null;
  return getFirestore(adminApp);
}

function getAdminStorage(): Storage | null {
  if (!adminApp) return null;
  return getStorage(adminApp);
}

// Export instances
export const adminAuth = getAdminAuth();
export const adminDb = getAdminFirestore();
export const adminStorage = getAdminStorage();

// Export app for advanced usage
export { adminApp };

// Helper to check if admin is available
export function isAdminInitialized(): boolean {
  return adminApp !== null;
}

// Types
export type { App as AdminApp } from 'firebase-admin/app';
export type { Auth as AdminAuth, UserRecord } from 'firebase-admin/auth';
export type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
export type { Storage as AdminStorage } from 'firebase-admin/storage';
