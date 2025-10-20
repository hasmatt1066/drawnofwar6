/**
 * TASK-VIZ-023: Combat Log Panel Component Implementation
 *
 * React component for displaying combat log entries in real-time.
 * Supports filtering, auto-scroll, and color-coded event types.
 */

import React, { useState, useEffect, useRef } from 'react';
import { CombatLog, CombatEventType, type CombatLogEntry } from '../../services/combat-log';
import styles from './CombatLogPanel.module.css';

export interface CombatLogPanelProps {
  /** Combat log instance */
  combatLog: CombatLog;

  /** Enable event type filtering */
  enableFiltering?: boolean;

  /** Auto-scroll to bottom on new entries */
  autoScroll?: boolean;

  /** Show clear button */
  showClearButton?: boolean;

  /** Maximum height of log panel */
  maxHeight?: string;
}

/**
 * CombatLogPanel Component
 *
 * Displays combat events in a scrollable, color-coded list.
 */
export const CombatLogPanel: React.FC<CombatLogPanelProps> = ({
  combatLog,
  enableFiltering = false,
  autoScroll = true,
  showClearButton = false,
  maxHeight = '400px'
}) => {
  const [entries, setEntries] = useState<CombatLogEntry[]>([]);
  const [filterType, setFilterType] = useState<CombatEventType | 'all'>('all');
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Update entries when combat log changes or filter changes
  useEffect(() => {
    const allEntries = combatLog.getEntries(
      filterType === 'all' ? undefined : filterType
    );
    setEntries(allEntries);
  }, [combatLog, filterType, updateTrigger]);

  // Auto-scroll to bottom when new entries are added
  // CRITICAL FIX: Scroll only the log container, not the entire page
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      // Scroll the container to its bottom, not the page
      const before = logContainerRef.current.scrollTop;
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      const after = logContainerRef.current.scrollTop;
      console.log('[CombatLogPanel] Container scroll:', { before, after, scrollHeight: logContainerRef.current.scrollHeight });
    }
  }, [entries, autoScroll]);

  // Poll for updates (in real implementation, this would use an observer pattern)
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleClear = () => {
    combatLog.clear();
    setUpdateTrigger(prev => prev + 1);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterType(e.target.value as CombatEventType | 'all');
  };

  return (
    <div className={styles.combatLogPanel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Combat Log</h3>

        <div className={styles.controls}>
          {enableFiltering && (
            <select
              className={styles.filterSelect}
              value={filterType}
              onChange={handleFilterChange}
              aria-label="Filter combat events"
            >
              <option value="all">All Events</option>
              <option value={CombatEventType.ATTACK}>Attacks</option>
              <option value={CombatEventType.DAMAGE}>Damage</option>
              <option value={CombatEventType.HEAL}>Healing</option>
              <option value={CombatEventType.DEATH}>Deaths</option>
              <option value={CombatEventType.ABILITY}>Abilities</option>
              <option value={CombatEventType.STATUS}>Status</option>
            </select>
          )}

          {showClearButton && (
            <button
              className={styles.clearButton}
              onClick={handleClear}
              aria-label="Clear log"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        ref={logContainerRef}
        className={styles.logContainer}
        role="log"
        style={{
          maxHeight,
          overflowY: 'auto'
        }}
      >
        {entries.length === 0 ? (
          <div className={styles.emptyState}>No combat events yet</div>
        ) : (
          <ul className={styles.logList}>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={styles.logEntry}
                style={{
                  color: combatLog.getEventColor(entry.type)
                }}
              >
                {combatLog.formatEntry(entry)}
              </li>
            ))}
            <div ref={logEndRef} />
          </ul>
        )}
      </div>
    </div>
  );
};
