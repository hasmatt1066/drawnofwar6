/**
 * Toast Notification System
 *
 * TASK-SJRG-5: Simple toast notification system for success/error messages
 *
 * Features:
 * - Displays toasts in top-right corner
 * - Auto-dismisses after 3 seconds
 * - Stacks multiple notifications
 * - Subscribe/unsubscribe pattern for React integration
 */

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
}

let notifications: Notification[] = [];
let listeners: Array<(notifications: Notification[]) => void> = [];

/**
 * Show a toast notification
 */
export function showNotification(type: NotificationType, message: string): void {
  const notification: Notification = {
    id: `${Date.now()}-${Math.random()}`,
    type,
    message,
    timestamp: Date.now()
  };

  notifications = [...notifications, notification];
  notifyListeners();

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    removeNotification(notification.id);
  }, 3000);
}

/**
 * Remove a specific notification
 */
export function removeNotification(id: string): void {
  notifications = notifications.filter(n => n.id !== id);
  notifyListeners();
}

/**
 * Subscribe to notification changes
 * Returns an unsubscribe function
 */
export function subscribe(callback: (notifications: Notification[]) => void): () => void {
  listeners.push(callback);

  // Immediately call with current notifications
  callback(notifications);

  // Return unsubscribe function
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

/**
 * Get current notifications (for testing)
 */
export function getNotifications(): Notification[] {
  return [...notifications];
}

/**
 * Clear all notifications (for testing)
 */
export function clearAllNotifications(): void {
  notifications = [];
  notifyListeners();
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(): void {
  listeners.forEach(listener => listener([...notifications]));
}
