/**
 * =====================================================
 * NOTIFICATION TYPES
 * =====================================================
 */

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  actionUrl?: string;
  data?: Record<string, unknown>;
  createdAt: Date;
  readAt?: Date;
}

export type NotificationType = 
  | 'attendance'
  | 'payroll'
  | 'advance'
  | 'loan'
  | 'announcement'
  | 'alert'
  | 'system';
