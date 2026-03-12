/**
 * =====================================================
 * FIREBASE EXPORTS
 * =====================================================
 * Centralized exports for Firebase modules.
 */

// Client-side Firebase
export { app, auth, db, storage, analytics } from './config';

// Auth utilities
export {
  signIn,
  signOut,
  resetPassword,
  changePassword,
  getUserProfile,
  subscribeToAuthState,
  getCurrentUser,
  hasRole,
  hasPermission,
} from './auth';

// Firestore utilities
export {
  getDocument,
  getDocuments,
  getPaginatedDocuments,
  createDocument,
  createDocumentWithId,
  updateDocument,
  deleteDocument,
  batchWrite,
  convertTimestamps,
  dateToTimestamp,
  generateDocId,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
} from './firestore';

// Storage utilities
export {
  STORAGE_PATHS,
  uploadFile,
  uploadFileWithProgress,
  deleteFile,
  deleteFileByUrl,
  getFileUrl,
  listFiles,
  uploadProfilePhoto,
  uploadAttendancePhoto,
  uploadPayslip,
  generateFileName,
} from './storage';

// Admin exports (server-side only)
// Note: Only import these in server components or API routes
// export { adminAuth, adminDb, adminStorage, isAdminInitialized } from './admin';
