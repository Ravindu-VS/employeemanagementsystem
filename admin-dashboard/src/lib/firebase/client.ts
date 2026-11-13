/**
 * Firebase Client - Re-exports from config for convenience
 * This allows importing from '@/lib/firebase/client'
 */
export { app, auth, db, storage, analytics } from './config';
export type { FirebaseApp, Auth, FirebaseUser, UserCredential, Firestore, DocumentReference, DocumentSnapshot, QuerySnapshot, FirebaseStorage, StorageReference, UploadResult } from './config';
