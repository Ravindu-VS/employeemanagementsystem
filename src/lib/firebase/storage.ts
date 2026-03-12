/**
 * =====================================================
 * FIREBASE STORAGE UTILITIES
 * =====================================================
 * File upload and download helpers.
 */

import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
  UploadTask,
  UploadTaskSnapshot,
} from 'firebase/storage';
import { storage } from './config';

/**
 * Storage paths for different file types
 */
export const STORAGE_PATHS = {
  PROFILE_PHOTOS: 'users/photos',
  EMPLOYEE_DOCUMENTS: 'users/documents',
  ATTENDANCE_PHOTOS: 'attendance/photos',
  PAYSLIPS: 'payroll/payslips',
  SITE_IMAGES: 'sites/images',
} as const;

/**
 * Upload a file and get the download URL
 */
export async function uploadFile(
  file: File | Blob,
  path: string,
  fileName?: string
): Promise<string> {
  try {
    const name = fileName || `${Date.now()}_${(file as File).name || 'file'}`;
    const fullPath = `${path}/${name}`;
    const storageRef = ref(storage, fullPath);
    
    // Upload file
    await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Upload a file with progress tracking
 */
export function uploadFileWithProgress(
  file: File | Blob,
  path: string,
  fileName?: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const name = fileName || `${Date.now()}_${(file as File).name || 'file'}`;
    const fullPath = `${path}/${name}`;
    const storageRef = ref(storage, fullPath);
    
    const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);
    
    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => {
        console.error('Upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

/**
 * Delete a file from storage
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error: any) {
    // Ignore if file doesn't exist
    if (error.code !== 'storage/object-not-found') {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
}

/**
 * Delete a file by URL
 */
export async function deleteFileByUrl(url: string): Promise<void> {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (error: any) {
    if (error.code !== 'storage/object-not-found') {
      console.error('Error deleting file by URL:', error);
      throw error;
    }
  }
}

/**
 * Get download URL for a path
 */
export async function getFileUrl(path: string): Promise<string> {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw error;
  }
}

/**
 * List all files in a directory
 */
export async function listFiles(path: string): Promise<string[]> {
  try {
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);
    
    const urls = await Promise.all(
      result.items.map((item) => getDownloadURL(item))
    );
    
    return urls;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

/**
 * Upload profile photo with resizing
 */
export async function uploadProfilePhoto(
  file: File,
  userId: string
): Promise<string> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }
  
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be less than 5MB');
  }
  
  const fileName = `${userId}_${Date.now()}.${getFileExtension(file.name)}`;
  return uploadFile(file, STORAGE_PATHS.PROFILE_PHOTOS, fileName);
}

/**
 * Upload attendance photo
 */
export async function uploadAttendancePhoto(
  file: File | Blob,
  employeeId: string,
  segmentId: string,
  type: 'start' | 'end'
): Promise<string> {
  const date = new Date().toISOString().split('T')[0];
  const fileName = `${date}_${employeeId}_${segmentId}_${type}.jpg`;
  return uploadFile(file, STORAGE_PATHS.ATTENDANCE_PHOTOS, fileName);
}

/**
 * Upload payslip PDF
 */
export async function uploadPayslip(
  file: Blob,
  employeeId: string,
  weekStartDate: string
): Promise<string> {
  const fileName = `${employeeId}_${weekStartDate}.pdf`;
  return uploadFile(file, STORAGE_PATHS.PAYSLIPS, fileName);
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || 'jpg';
}

/**
 * Generate a unique filename
 */
export function generateFileName(originalName: string, prefix?: string): string {
  const ext = getFileExtension(originalName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return prefix
    ? `${prefix}_${timestamp}_${random}.${ext}`
    : `${timestamp}_${random}.${ext}`;
}
