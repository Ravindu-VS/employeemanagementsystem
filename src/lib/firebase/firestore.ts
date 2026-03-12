/**
 * =====================================================
 * FIRESTORE UTILITIES
 * =====================================================
 * Common Firestore operations and helpers.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  QueryConstraint,
  serverTimestamp,
  writeBatch,
  Timestamp,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import type { PaginatedResponse, PaginationParams } from '@/types';

/**
 * Generic function to get a single document by ID
 */
export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...convertTimestamps(docSnap.data()),
    } as T;
  } catch (error) {
    console.error(`Error getting document from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Generic function to get all documents in a collection
 */
export async function getDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  try {
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, ...constraints);
    const querySnap = await getDocs(q);
    
    return querySnap.docs.map((doc) => ({
      id: doc.id,
      ...convertTimestamps(doc.data()),
    })) as T[];
  } catch (error) {
    console.error(`Error getting documents from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Get paginated documents
 */
export async function getPaginatedDocuments<T>(
  collectionName: string,
  params: PaginationParams,
  constraints: QueryConstraint[] = [],
  lastDoc?: DocumentSnapshot
): Promise<PaginatedResponse<T>> {
  try {
    const collectionRef = collection(db, collectionName);
    
    // Build query with pagination
    const queryConstraints: QueryConstraint[] = [
      ...constraints,
      limit(params.limit + 1), // Fetch one extra to check if there's more
    ];
    
    // Add sorting
    if (params.sortBy) {
      queryConstraints.push(orderBy(params.sortBy, params.sortOrder || 'asc'));
    }
    
    // Add cursor for pagination
    if (lastDoc) {
      queryConstraints.push(startAfter(lastDoc));
    }
    
    const q = query(collectionRef, ...queryConstraints);
    const querySnap = await getDocs(q);
    
    // Check if there are more results
    const hasMore = querySnap.docs.length > params.limit;
    const docs = hasMore ? querySnap.docs.slice(0, -1) : querySnap.docs;
    
    return {
      data: docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as T[],
      total: -1, // Firestore doesn't provide total count efficiently
      page: params.page,
      limit: params.limit,
      hasMore,
      nextCursor: hasMore ? querySnap.docs[params.limit - 1].id : undefined,
    };
  } catch (error) {
    console.error(`Error getting paginated documents from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Create a new document
 */
export async function createDocument<T>(
  collectionName: string,
  data: Omit<T, 'id'>
): Promise<string> {
  try {
    const collectionRef = collection(db, collectionName);
    const docRef = await addDoc(collectionRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Create a document with a specific ID
 */
export async function createDocumentWithId<T>(
  collectionName: string,
  docId: string,
  data: Omit<T, 'id'>
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, docId);
    const { setDoc } = await import('firebase/firestore');
    await setDoc(docRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error creating document with ID in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Update an existing document
 */
export async function updateDocument<T>(
  collectionName: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Batch write multiple documents
 */
export async function batchWrite(
  operations: Array<{
    type: 'create' | 'update' | 'delete';
    collection: string;
    id?: string;
    data?: Record<string, unknown>;
  }>
): Promise<string[]> {
  const batch = writeBatch(db);
  const createdIds: string[] = [];
  
  for (const op of operations) {
    if (op.type === 'create') {
      const docRef = op.id
        ? doc(db, op.collection, op.id)
        : doc(collection(db, op.collection));
      batch.set(docRef, {
        ...op.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdIds.push(docRef.id);
    } else if (op.type === 'update' && op.id) {
      const docRef = doc(db, op.collection, op.id);
      batch.update(docRef, {
        ...op.data,
        updatedAt: serverTimestamp(),
      });
    } else if (op.type === 'delete' && op.id) {
      const docRef = doc(db, op.collection, op.id);
      batch.delete(docRef);
    }
  }
  
  await batch.commit();
  return createdIds;
}

/**
 * Convert Firestore Timestamps to JavaScript Dates
 */
export function convertTimestamps(data: Record<string, unknown>): Record<string, unknown> {
  const converted: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      converted[key] = value.toDate();
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      converted[key] = convertTimestamps(value as Record<string, unknown>);
    } else {
      converted[key] = value;
    }
  }
  
  return converted;
}

/**
 * Convert JavaScript Date to Firestore Timestamp
 */
export function dateToTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/**
 * Generate a unique document ID
 */
export function generateDocId(collectionName: string): string {
  return doc(collection(db, collectionName)).id;
}

// Re-export common Firestore functions for convenience
export {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
