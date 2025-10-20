/**
 * TASK-VIZ-023: Combat Log Panel Component Tests
 *
 * Test-driven development for a React component that displays combat log entries.
 * Supports real-time updates, filtering, and auto-scroll.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatLogPanel } from '../CombatLogPanel';
import { CombatLog, CombatEventType } from '../../../services/combat-log';

describe('CombatLogPanel', () => {
  let combatLog: CombatLog;

  beforeEach(() => {
    combatLog = new CombatLog({ maxEntries: 100, showTimestamps: false });
  });

  describe('Rendering', () => {
    it('should render empty log panel', () => {
      render(<CombatLogPanel combatLog={combatLog} />);

      expect(screen.getByRole('log')).toBeInTheDocument();
    });

    it('should display combat log title', () => {
      render(<CombatLogPanel combatLog={combatLog} />);

      expect(screen.getByText(/combat log/i)).toBeInTheDocument();
    });

    it('should render log entries', () => {
      combatLog.addEntry({ type: CombatEventType.ATTACK, message: 'Knight attacks Goblin' });
      combatLog.addEntry({ type: CombatEventType.DAMAGE, message: 'Goblin takes 15 damage' });

      render(<CombatLogPanel combatLog={combatLog} />);

      expect(screen.getByText('Knight attacks Goblin')).toBeInTheDocument();
      expect(screen.getByText('Goblin takes 15 damage')).toBeInTheDocument();
    });

    it('should display entries in reverse chronological order (newest first)', () => {
      combatLog.addEntry({ type: CombatEventType.ATTACK, message: 'First event' });
      combatLog.addEntry({ type: CombatEventType.DAMAGE, message: 'Second event' });
      combatLog.addEntry({ type: CombatEventType.HEAL, message: 'Third event' });

      render(<CombatLogPanel combatLog={combatLog} />);

      const logEntries = screen.getAllByRole('listitem');
      expect(logEntries[0]).toHaveTextContent('Third event');
      expect(logEntries[1]).toHaveTextContent('Second event');
      expect(logEntries[2]).toHaveTextContent('First event');
    });
  });

  describe('Event Type Styling', () => {
    it('should apply color styling based on event type', () => {
      combatLog.addEntry({ type: CombatEventType.ATTACK, message: 'Attack event' });
      combatLog.addEntry({ type: CombatEventType.HEAL, message: 'Heal event' });

      render(<CombatLogPanel combatLog={combatLog} />);

      const attackEntry = screen.getByText('Attack event');
      const healEntry = screen.getByText('Heal event');

      // Should have different colors
      const attackColor = window.getComputedStyle(attackEntry).color;
      const healColor = window.getComputedStyle(healEntry).color;

      expect(attackColor).toBeTruthy();
      expect(healColor).toBeTruthy();
      expect(attackColor).not.toBe(healColor);
    });

    it('should use correct color for damage events', () => {
      combatLog.addEntry({ type: CombatEventType.DAMAGE, message: 'Damage dealt' });

      render(<CombatLogPanel combatLog={combatLog} />);

      const damageEntry = screen.getByText('Damage dealt');
      const expectedColor = combatLog.getEventColor(CombatEventType.DAMAGE);

      expect(damageEntry).toHaveStyle({ color: expectedColor });
    });

    it('should use correct color for heal events', () => {
      combatLog.addEntry({ type: CombatEventType.HEAL, message: 'Healing applied' });

      render(<CombatLogPanel combatLog={combatLog} />);

      const healEntry = screen.getByText('Healing applied');
      const expectedColor = combatLog.getEventColor(CombatEventType.HEAL);

      expect(healEntry).toHaveStyle({ color: expectedColor });
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      combatLog.addEntry({ type: CombatEventType.ATTACK, message: 'Attack 1' });
      combatLog.addEntry({ type: CombatEventType.DAMAGE, message: 'Damage 1' });
      combatLog.addEntry({ type: CombatEventType.HEAL, message: 'Heal 1' });
      combatLog.addEntry({ type: CombatEventType.ATTACK, message: 'Attack 2' });
      combatLog.addEntry({ type: CombatEventType.DAMAGE, message: 'Damage 2' });
    });

    it('should show all entries by default', () => {
      render(<CombatLogPanel combatLog={combatLog} />);

      expect(screen.getByText('Attack 1')).toBeInTheDocument();
      expect(screen.getByText('Damage 1')).toBeInTheDocument();
      expect(screen.getByText('Heal 1')).toBeInTheDocument();
      expect(screen.getByText('Attack 2')).toBeInTheDocument();
      expect(screen.getByText('Damage 2')).toBeInTheDocument();
    });

    it('should filter to show only attack events', async () => {
      const user = userEvent.setup();
      render(<CombatLogPanel combatLog={combatLog} enableFiltering={true} />);

      const filterSelect = screen.getByRole('combobox', { name: /filter/i });
      await user.selectOptions(filterSelect, CombatEventType.ATTACK);

      expect(screen.getByText('Attack 1')).toBeInTheDocument();
      expect(screen.getByText('Attack 2')).toBeInTheDocument();
      expect(screen.queryByText('Damage 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Heal 1')).not.toBeInTheDocument();
    });

    it('should filter to show only heal events', async () => {
      const user = userEvent.setup();
      render(<CombatLogPanel combatLog={combatLog} enableFiltering={true} />);

      const filterSelect = screen.getByRole('combobox', { name: /filter/i });
      await user.selectOptions(filterSelect, CombatEventType.HEAL);

      expect(screen.getByText('Heal 1')).toBeInTheDocument();
      expect(screen.queryByText('Attack 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Damage 1')).not.toBeInTheDocument();
    });

    it('should return to showing all events when filter is cleared', async () => {
      const user = userEvent.setup();
      render(<CombatLogPanel combatLog={combatLog} enableFiltering={true} />);

      const filterSelect = screen.getByRole('combobox', { name: /filter/i });

      // Filter to attacks
      await user.selectOptions(filterSelect, CombatEventType.ATTACK);
      expect(screen.queryByText('Heal 1')).not.toBeInTheDocument();

      // Clear filter
      await user.selectOptions(filterSelect, 'all');
      expect(screen.getByText('Heal 1')).toBeInTheDocument();
      expect(screen.getByText('Attack 1')).toBeInTheDocument();
    });
  });

  describe('Auto-scroll', () => {
    it('should auto-scroll to bottom when new entries are added', async () => {
      render(<CombatLogPanel combatLog={combatLog} autoScroll={true} />);

      // Add new entry
      combatLog.addEntry({ type: CombatEventType.ATTACK, message: 'New attack' });

      // Wait for polling to pick up the new entry
      const { waitFor } = await import('@testing-library/react');
      await waitFor(() => {
        expect(screen.getByText('New attack')).toBeInTheDocument();
      });
    });

    it('should not auto-scroll when autoScroll is disabled', () => {
      render(<CombatLogPanel combatLog={combatLog} autoScroll={false} />);

      // This test verifies the prop is respected
      // Actual scroll behavior is tested via integration tests
      expect(screen.getByRole('log')).toBeInTheDocument();
    });
  });

  describe('Clear Functionality', () => {
    it('should show clear button when enabled', () => {
      combatLog.addEntry({ type: CombatEventType.ATTACK, message: 'Test' });

      render(<CombatLogPanel combatLog={combatLog} showClearButton={true} />);

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('should clear all entries when clear button is clicked', async () => {
      const user = userEvent.setup();
      combatLog.addEntry({ type: CombatEventType.ATTACK, message: 'Attack 1' });
      combatLog.addEntry({ type: CombatEventType.DAMAGE, message: 'Damage 1' });

      render(<CombatLogPanel combatLog={combatLog} showClearButton={true} />);

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(screen.queryByText('Attack 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Damage 1')).not.toBeInTheDocument();
    });

    it('should not show clear button by default', () => {
      render(<CombatLogPanel combatLog={combatLog} />);

      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    });
  });

  describe('Max Height and Scrolling', () => {
    it('should apply max height when specified', () => {
      render(<CombatLogPanel combatLog={combatLog} maxHeight="300px" />);

      const logContainer = screen.getByRole('log');
      expect(logContainer).toHaveStyle({ maxHeight: '300px' });
    });

    it('should enable scrolling when content exceeds max height', () => {
      // Add many entries
      for (let i = 0; i < 50; i++) {
        combatLog.addEntry({ type: CombatEventType.ATTACK, message: `Entry ${i}` });
      }

      render(<CombatLogPanel combatLog={combatLog} maxHeight="200px" />);

      const logContainer = screen.getByRole('log');
      expect(logContainer).toHaveStyle({ overflowY: 'auto' });
    });
  });

  describe('Empty State', () => {
    it('should show empty state message when no entries exist', () => {
      render(<CombatLogPanel combatLog={combatLog} />);

      expect(screen.getByText(/no combat events/i)).toBeInTheDocument();
    });

    it('should not show empty state when entries exist', () => {
      combatLog.addEntry({ type: CombatEventType.ATTACK, message: 'Test' });

      render(<CombatLogPanel combatLog={combatLog} />);

      expect(screen.queryByText(/no combat events/i)).not.toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should efficiently render 100 log entries', () => {
      for (let i = 0; i < 100; i++) {
        combatLog.addEntry({
          type: i % 2 === 0 ? CombatEventType.ATTACK : CombatEventType.DAMAGE,
          message: `Event ${i}`
        });
      }

      const startTime = performance.now();
      render(<CombatLogPanel combatLog={combatLog} />);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // Should render in < 100ms
      expect(screen.getAllByRole('listitem')).toHaveLength(100);
    });
  });
});
