/**
 * =====================================================
 * WORKFORCEX — CONFIGURABLE LOGGING UTILITY
 * =====================================================
 * Structured, toggleable logger that replaces raw console.log.
 * 
 * Usage:
 *   import { createLogger } from '@/lib/logger';
 *   const log = createLogger('PayrollAggregation');
 *   log.debug('Building entries', { count: records.length });
 *   log.warn('Duplicate detected', { workerId, date });
 * 
 * Enable in .env.local:
 *   NEXT_PUBLIC_DEBUG=true              → all namespaces
 *   NEXT_PUBLIC_DEBUG=Payroll,Advance   → specific namespaces only
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Check if debug logging is enabled for a given namespace
 */
function isDebugEnabled(namespace: string): boolean {
  if (typeof window === 'undefined') return false;
  
  const debugFlag = process.env.NEXT_PUBLIC_DEBUG;
  if (!debugFlag) return false;
  if (debugFlag === 'true' || debugFlag === '*') return true;
  
  // Support comma-separated namespace filtering
  const enabledNamespaces = debugFlag.split(',').map(s => s.trim().toLowerCase());
  return enabledNamespaces.some(ns => namespace.toLowerCase().includes(ns));
}

/**
 * Format a structured log message
 */
function formatMessage(namespace: string, level: LogLevel, message: string): string {
  const icons: Record<LogLevel, string> = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };
  return `${icons[level]} [${namespace}] ${message}`;
}

/**
 * Create a namespaced logger instance.
 * 
 * - `debug` and `info` only fire when NEXT_PUBLIC_DEBUG is enabled
 * - `warn` and `error` always fire (production-safe)
 */
export function createLogger(namespace: string): Logger {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (!isDebugEnabled(namespace)) return;
      if (data) {
        console.log(formatMessage(namespace, 'debug', message), data);
      } else {
        console.log(formatMessage(namespace, 'debug', message));
      }
    },

    info(message: string, data?: Record<string, unknown>) {
      if (!isDebugEnabled(namespace)) return;
      if (data) {
        console.info(formatMessage(namespace, 'info', message), data);
      } else {
        console.info(formatMessage(namespace, 'info', message));
      }
    },

    warn(message: string, data?: Record<string, unknown>) {
      // Warnings always show — useful for production diagnostics
      if (data) {
        console.warn(formatMessage(namespace, 'warn', message), data);
      } else {
        console.warn(formatMessage(namespace, 'warn', message));
      }
    },

    error(message: string, data?: Record<string, unknown>) {
      // Errors always show
      if (data) {
        console.error(formatMessage(namespace, 'error', message), data);
      } else {
        console.error(formatMessage(namespace, 'error', message));
      }
    },
  };
}
