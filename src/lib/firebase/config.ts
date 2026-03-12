/**
 * =====================================================
 * FIREBASE CLIENT CONFIGURATION
 * =====================================================
 * Client-side Firebase SDK initialization.
 * Used for authentication, Firestore operations, and Storage.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate configuration
function validateConfig(): void {
  const requiredFields = [
    'apiKey',
    'authDomain', 
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ] as const;
  
  const missingFields = requiredFields.filter(
    (field) => !firebaseConfig[field]
  );
  
  if (missingFields.length > 0) {
    console.warn(
      `Firebase config missing fields: ${missingFields.join(', ')}. ` +
      'Make sure .env.local is properly configured.'
    );
  }
}

// Initialize Firebase app (singleton pattern)
function initializeFirebaseApp(): FirebaseApp {
  validateConfig();
  
  if (getApps().length > 0) {
    return getApp();
  }
  
  return initializeApp(firebaseConfig);
}

// Firebase app instance
const app: FirebaseApp = initializeFirebaseApp();

// Firebase Auth instance
const auth: Auth = getAuth(app);

// Firestore instance
const db: Firestore = getFirestore(app);

// Storage instance
const storage: FirebaseStorage = getStorage(app);

// Analytics instance (only in browser)
let analytics: Analytics | null = null;

// Initialize analytics in browser
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

// Connect to emulators in development
if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
  console.log('🔧 Connecting to Firebase emulators...');
  
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log('✅ Connected to Firebase emulators');
  } catch (error) {
    console.warn('Failed to connect to emulators:', error);
  }
}

// Export instances
export { app, auth, db, storage, analytics };

// Export types for convenience
export type { FirebaseApp } from 'firebase/app';
export type { Auth, User as FirebaseUser, UserCredential } from 'firebase/auth';
export type { Firestore, DocumentReference, DocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
export type { FirebaseStorage, StorageReference, UploadResult } from 'firebase/storage';
