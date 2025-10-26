/**
 * Notification Container Component
 *
 * TASK-SJRG-5: Displays toast notifications in top-right corner
 *
 * Features:
 * - Auto-dismiss after 3 seconds
 * - Animated entrance/exit
 * - Stacks multiple notifications
 * - Accessible with ARIA labels
 */

import { useEffect, useState } from 'react';
import {
  subscribe,
  removeNotification,
  type Notification
} from '../utils/notifications';
import './NotificationContainer.css';

export function NotificationContainer() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe(setNotifications);
    return unsubscribe;
  }, []);

  return (
    <div className="notification-container" aria-live="polite" aria-atomic="false">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
          role="alert"
          aria-label={`${notification.type} notification`}
        >
          <div className="notification-content">
            <span className="notification-icon">
              {notification.type === 'success' && '✓'}
              {notification.type === 'error' && '✕'}
              {notification.type === 'info' && 'ℹ'}
            </span>
            <span className="notification-message">{notification.message}</span>
          </div>
          <button
            className="notification-close"
            onClick={() => removeNotification(notification.id)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
