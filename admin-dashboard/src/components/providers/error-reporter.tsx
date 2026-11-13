'use client';
import { useEffect } from 'react';
import { installGlobalErrorHandlers } from '@/services/maintenance-service';

/** Sends uncaught browser errors to the clientErrors collection (System page). */
export function ErrorReporter() {
  useEffect(() => installGlobalErrorHandlers(), []);
  return null;
}
