/**
 * Battle Lobby Page Integration Tests
 *
 * Tests for Create Battle, Join by Key, and Quick Play integrations
 * Following TDD approach - tests written first
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { BattleLobbyPage } from '../BattleLobbyPage';
import * as battleApi from '../../services/battle-api';
import {
  InsufficientCreaturesError,
  ActiveBattleExistsError
} from '../../services/battle-api-errors';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock battle API
vi.mock('../../services/battle-api');

// Helper to render with router
function renderWithRouter(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
}

describe('BattleLobbyPage - Create Battle Integration', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Create Battle API Integration', () => {
    it('should call createBattle API when creating battle', async () => {
      const user = userEvent.setup();
      const mockCreateBattle = vi.fn().mockResolvedValue({
        success: true,
        battleId: 'battle-123',
        battleKey: 'ABC123',
        matchId: 'match-456',
        playerId: 'player1'
      });

      vi.spyOn(battleApi, 'createBattle').mockImplementation(mockCreateBattle);

      renderWithRouter(<BattleLobbyPage />);

      // Open create battle modal - use button role to be specific
      const createButton = screen.getByRole('button', { name: /create battle/i });
      await user.click(createButton);

      // Fill in battle name
      const input = screen.getByPlaceholderText('Epic Showdown');
      await user.type(input, 'My Awesome Battle');

      // Click Create button
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // Verify API was called with correct params
      expect(mockCreateBattle).toHaveBeenCalledWith('My Awesome Battle', true);
    });

    it('should navigate to deployment page on successful creation', async () => {
      const user = userEvent.setup();
      const mockCreateBattle = vi.fn().mockResolvedValue({
        success: true,
        battleId: 'battle-123',
        battleKey: 'ABC123',
        matchId: 'match-456',
        playerId: 'player1'
      });

      vi.spyOn(battleApi, 'createBattle').mockImplementation(mockCreateBattle);

      renderWithRouter(<BattleLobbyPage />);

      await user.click(screen.getByRole('button', { name: /create battle/i }));
      const input = screen.getByPlaceholderText('Epic Showdown');
      await user.type(input, 'Test Battle');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/deployment?matchId=match-456&playerId=player1');
      });
    });

    it('should close modal on successful creation', async () => {
      const user = userEvent.setup();
      const mockCreateBattle = vi.fn().mockResolvedValue({
        success: true,
        battleId: 'battle-123',
        battleKey: 'ABC123',
        matchId: 'match-456',
        playerId: 'player1'
      });

      vi.spyOn(battleApi, 'createBattle').mockImplementation(mockCreateBattle);

      renderWithRouter(<BattleLobbyPage />);

      await user.click(screen.getByRole('button', { name: /create battle/i }));
      const input = screen.getByPlaceholderText('Epic Showdown');
      await user.type(input, 'Test Battle');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // Modal should close (input should no longer be in document)
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Epic Showdown')).not.toBeInTheDocument();
      });
    });

    it('should show loading state during battle creation', async () => {
      const user = userEvent.setup();
      let resolveCreate: any;
      const mockCreateBattle = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );

      vi.spyOn(battleApi, 'createBattle').mockImplementation(mockCreateBattle);

      renderWithRouter(<BattleLobbyPage />);

      await user.click(screen.getByRole('button', { name: /create battle/i }));
      const input = screen.getByPlaceholderText('Epic Showdown');
      await user.type(input, 'Test Battle');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // Should show loading state
      expect(screen.getByText('Creating...')).toBeInTheDocument();

      // Clean up
      resolveCreate({
        success: true,
        battleId: 'test',
        battleKey: 'ABC123',
        matchId: 'match-1',
        playerId: 'player1'
      });
    });

    it('should show error message for insufficient creatures', async () => {
      const user = userEvent.setup();
      const mockCreateBattle = vi.fn().mockRejectedValue(
        new InsufficientCreaturesError('You need at least 3 creatures to create a battle')
      );

      vi.spyOn(battleApi, 'createBattle').mockImplementation(mockCreateBattle);

      renderWithRouter(<BattleLobbyPage />);

      await user.click(screen.getByRole('button', { name: /create battle/i }));
      const input = screen.getByPlaceholderText('Epic Showdown');
      await user.type(input, 'Test Battle');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // Should show error message
      expect(await screen.findByText(/need at least 3 creatures/i)).toBeInTheDocument();
    });

    it('should show error message for active battle exists', async () => {
      const user = userEvent.setup();
      const mockCreateBattle = vi.fn().mockRejectedValue(
        new ActiveBattleExistsError('You already have an active battle')
      );

      vi.spyOn(battleApi, 'createBattle').mockImplementation(mockCreateBattle);

      renderWithRouter(<BattleLobbyPage />);

      await user.click(screen.getByRole('button', { name: /create battle/i }));
      const input = screen.getByPlaceholderText('Epic Showdown');
      await user.type(input, 'Test Battle');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // Should show error message
      expect(await screen.findByText(/already have an active battle/i)).toBeInTheDocument();
    });

    it('should show error message for network failures', async () => {
      const user = userEvent.setup();
      const mockCreateBattle = vi.fn().mockRejectedValue(
        new Error('Network request failed')
      );

      vi.spyOn(battleApi, 'createBattle').mockImplementation(mockCreateBattle);

      renderWithRouter(<BattleLobbyPage />);

      await user.click(screen.getByRole('button', { name: /create battle/i }));
      const input = screen.getByPlaceholderText('Epic Showdown');
      await user.type(input, 'Test Battle');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // Should show error message
      expect(await screen.findByText(/network request failed/i)).toBeInTheDocument();
    });

    it('should not call API if battle name is empty', async () => {
      const user = userEvent.setup();
      const mockCreateBattle = vi.fn();

      vi.spyOn(battleApi, 'createBattle').mockImplementation(mockCreateBattle);

      renderWithRouter(<BattleLobbyPage />);

      await user.click(screen.getByRole('button', { name: /create battle/i }));
      // Don't type anything in the input
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // API should not be called
      expect(mockCreateBattle).not.toHaveBeenCalled();
    });

    it('should clear error when modal is closed', async () => {
      const user = userEvent.setup();
      const mockCreateBattle = vi.fn().mockRejectedValue(
        new Error('Test error')
      );

      vi.spyOn(battleApi, 'createBattle').mockImplementation(mockCreateBattle);

      renderWithRouter(<BattleLobbyPage />);

      await user.click(screen.getByRole('button', { name: /create battle/i }));
      const input = screen.getByPlaceholderText('Epic Showdown');
      await user.type(input, 'Test Battle');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // Wait for error to appear
      expect(await screen.findByText(/test error/i)).toBeInTheDocument();

      // Close modal
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      // Reopen modal - error should be cleared
      await user.click(screen.getByRole('button', { name: /create battle/i }));
      expect(screen.queryByText(/test error/i)).not.toBeInTheDocument();
    });
  });
});
