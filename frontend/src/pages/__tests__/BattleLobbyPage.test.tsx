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
  ActiveBattleExistsError,
  BattleNotFoundError,
  BattleAlreadyFilledError,
  CannotJoinOwnBattleError
} from '../../services/battle-api-errors';
import * as useLobbySocketModule from '../../hooks/useLobbySocket';
import type { LobbyBattle } from '../../services/lobby-socket';

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

// Mock useLobbySocket hook
vi.mock('../../hooks/useLobbySocket');

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

    // Mock useLobbySocket hook with default values
    vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
      battles: [],
      isConnected: true,
      error: null
    });
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

  describe('Join by Key API Integration', () => {
    it('should call joinBattleByKey API when joining with valid key', async () => {
      const user = userEvent.setup();
      const mockJoinBattleByKey = vi.fn().mockResolvedValue({
        success: true,
        battleId: 'battle-789',
        matchId: 'match-999',
        playerId: 'player2'
      });

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      // Type valid battle key
      const input = screen.getByPlaceholderText('K3P9X2');
      await user.type(input, 'ABC123');

      // Click Join button
      const joinButton = screen.getByRole('button', { name: 'Join' });
      await user.click(joinButton);

      // Verify API was called with correct key
      expect(mockJoinBattleByKey).toHaveBeenCalledWith('ABC123');
    });

    it('should navigate to deployment page on successful join', async () => {
      const user = userEvent.setup();
      const mockJoinBattleByKey = vi.fn().mockResolvedValue({
        success: true,
        battleId: 'battle-789',
        matchId: 'match-999',
        playerId: 'player2'
      });

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const input = screen.getByPlaceholderText('K3P9X2');
      await user.type(input, 'XYZ789');

      const joinButton = screen.getByRole('button', { name: 'Join' });
      await user.click(joinButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/deployment?matchId=match-999&playerId=player2');
      });
    });

    it('should clear battle key input on successful join', async () => {
      const user = userEvent.setup();
      const mockJoinBattleByKey = vi.fn().mockResolvedValue({
        success: true,
        battleId: 'battle-789',
        matchId: 'match-999',
        playerId: 'player2'
      });

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const input = screen.getByPlaceholderText('K3P9X2') as HTMLInputElement;
      await user.type(input, 'ABC123');

      const joinButton = screen.getByRole('button', { name: 'Join' });
      await user.click(joinButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should show loading state during join', async () => {
      const user = userEvent.setup();
      let resolveJoin: any;
      const mockJoinBattleByKey = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          resolveJoin = resolve;
        })
      );

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const input = screen.getByPlaceholderText('K3P9X2');
      await user.type(input, 'ABC123');

      const joinButton = screen.getByRole('button', { name: 'Join' });
      await user.click(joinButton);

      // Should show loading state
      expect(screen.getByText('Joining...')).toBeInTheDocument();

      // Clean up
      resolveJoin({
        success: true,
        battleId: 'test',
        matchId: 'match-1',
        playerId: 'player2'
      });
    });

    it('should show error for battle not found', async () => {
      const user = userEvent.setup();
      const mockJoinBattleByKey = vi.fn().mockRejectedValue(
        new BattleNotFoundError('Battle with key ABC123 not found')
      );

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const input = screen.getByPlaceholderText('K3P9X2');
      await user.type(input, 'ABC123');

      const joinButton = screen.getByRole('button', { name: 'Join' });
      await user.click(joinButton);

      expect(await screen.findByText(/battle.*not found/i)).toBeInTheDocument();
    });

    it('should show error for battle already filled', async () => {
      const user = userEvent.setup();
      const mockJoinBattleByKey = vi.fn().mockRejectedValue(
        new BattleAlreadyFilledError('This battle has already started or is full')
      );

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const input = screen.getByPlaceholderText('K3P9X2');
      await user.type(input, 'FULL01');

      const joinButton = screen.getByRole('button', { name: 'Join' });
      await user.click(joinButton);

      expect(await screen.findByText(/already started or is full/i)).toBeInTheDocument();
    });

    it('should show error for trying to join own battle', async () => {
      const user = userEvent.setup();
      const mockJoinBattleByKey = vi.fn().mockRejectedValue(
        new CannotJoinOwnBattleError('You cannot join your own battle')
      );

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const input = screen.getByPlaceholderText('K3P9X2');
      await user.type(input, 'MINE01');

      const joinButton = screen.getByRole('button', { name: 'Join' });
      await user.click(joinButton);

      expect(await screen.findByText(/cannot join your own battle/i)).toBeInTheDocument();
    });

    it('should show error for insufficient creatures', async () => {
      const user = userEvent.setup();
      const mockJoinBattleByKey = vi.fn().mockRejectedValue(
        new InsufficientCreaturesError('You need at least 3 creatures to join a battle')
      );

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const input = screen.getByPlaceholderText('K3P9X2');
      await user.type(input, 'ABC123');

      const joinButton = screen.getByRole('button', { name: 'Join' });
      await user.click(joinButton);

      expect(await screen.findByText(/need at least 3 creatures/i)).toBeInTheDocument();
    });

    it('should show error for network failures', async () => {
      const user = userEvent.setup();
      const mockJoinBattleByKey = vi.fn().mockRejectedValue(
        new Error('Network connection failed')
      );

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const input = screen.getByPlaceholderText('K3P9X2');
      await user.type(input, 'ABC123');

      const joinButton = screen.getByRole('button', { name: 'Join' });
      await user.click(joinButton);

      expect(await screen.findByText(/network connection failed/i)).toBeInTheDocument();
    });

    it('should keep join button disabled for invalid key lengths', async () => {
      const user = userEvent.setup();

      renderWithRouter(<BattleLobbyPage />);

      const joinButton = screen.getByRole('button', { name: 'Join' });
      const input = screen.getByPlaceholderText('K3P9X2');

      // Initially disabled
      expect(joinButton).toBeDisabled();

      // Still disabled with less than 6 characters
      await user.type(input, 'ABC');
      expect(joinButton).toBeDisabled();

      // Enabled with exactly 6 characters
      await user.type(input, '123');
      expect(joinButton).toBeEnabled();

      // Still enabled (input maxLength prevents more than 6)
      await user.type(input, '7');
      expect(joinButton).toBeEnabled();
    });
  });

  describe('Quick Play API Integration', () => {
    it('should call quickPlay API when Quick Play button clicked', async () => {
      const user = userEvent.setup();
      const mockQuickPlay = vi.fn().mockResolvedValue({
        success: true,
        action: 'joined',
        battleId: 'battle-123',
        battleKey: 'ABC123',
        matchId: 'match-456',
        playerId: 'player2'
      });

      vi.spyOn(battleApi, 'quickPlay').mockImplementation(mockQuickPlay);

      renderWithRouter(<BattleLobbyPage />);

      const quickPlayButton = screen.getByRole('button', { name: /quick play/i });
      await user.click(quickPlayButton);

      expect(mockQuickPlay).toHaveBeenCalled();
    });

    it('should navigate to deployment when joining existing battle', async () => {
      const user = userEvent.setup();
      const mockQuickPlay = vi.fn().mockResolvedValue({
        success: true,
        action: 'joined',
        battleId: 'battle-123',
        matchId: 'match-456',
        playerId: 'player2'
      });

      vi.spyOn(battleApi, 'quickPlay').mockImplementation(mockQuickPlay);

      renderWithRouter(<BattleLobbyPage />);

      const quickPlayButton = screen.getByRole('button', { name: /quick play/i });
      await user.click(quickPlayButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/deployment?matchId=match-456&playerId=player2');
      });
    });

    it('should navigate to deployment when creating new battle', async () => {
      const user = userEvent.setup();
      const mockQuickPlay = vi.fn().mockResolvedValue({
        success: true,
        action: 'created',
        battleId: 'battle-new',
        battleKey: 'XYZ789',
        matchId: 'match-789',
        playerId: 'player1'
      });

      vi.spyOn(battleApi, 'quickPlay').mockImplementation(mockQuickPlay);

      renderWithRouter(<BattleLobbyPage />);

      const quickPlayButton = screen.getByRole('button', { name: /quick play/i });
      await user.click(quickPlayButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/deployment?matchId=match-789&playerId=player1');
      });
    });

    it('should show loading state during Quick Play', async () => {
      const user = userEvent.setup();
      let resolveQuickPlay: any;
      const mockQuickPlay = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          resolveQuickPlay = resolve;
        })
      );

      vi.spyOn(battleApi, 'quickPlay').mockImplementation(mockQuickPlay);

      renderWithRouter(<BattleLobbyPage />);

      const quickPlayButton = screen.getByRole('button', { name: /quick play/i });
      await user.click(quickPlayButton);

      // Should show searching state
      expect(screen.getByText('Searching...')).toBeInTheDocument();

      // Clean up
      resolveQuickPlay({
        success: true,
        action: 'joined',
        matchId: 'match-1',
        playerId: 'player2'
      });
    });

    it('should disable button during Quick Play loading', async () => {
      const user = userEvent.setup();
      let resolveQuickPlay: any;
      const mockQuickPlay = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          resolveQuickPlay = resolve;
        })
      );

      vi.spyOn(battleApi, 'quickPlay').mockImplementation(mockQuickPlay);

      renderWithRouter(<BattleLobbyPage />);

      const quickPlayButton = screen.getByRole('button', { name: /quick play/i });
      await user.click(quickPlayButton);

      // Button should be disabled
      expect(quickPlayButton).toBeDisabled();

      // Clean up
      resolveQuickPlay({
        success: true,
        action: 'joined',
        matchId: 'match-1',
        playerId: 'player2'
      });
    });

    it('should show error for insufficient creatures', async () => {
      const user = userEvent.setup();
      const mockQuickPlay = vi.fn().mockRejectedValue(
        new InsufficientCreaturesError('You need at least 3 creatures for Quick Play')
      );

      vi.spyOn(battleApi, 'quickPlay').mockImplementation(mockQuickPlay);

      renderWithRouter(<BattleLobbyPage />);

      const quickPlayButton = screen.getByRole('button', { name: /quick play/i });
      await user.click(quickPlayButton);

      expect(await screen.findByText(/need at least 3 creatures/i)).toBeInTheDocument();
    });

    it('should show error for active battle exists', async () => {
      const user = userEvent.setup();
      const mockQuickPlay = vi.fn().mockRejectedValue(
        new ActiveBattleExistsError('You already have an active battle')
      );

      vi.spyOn(battleApi, 'quickPlay').mockImplementation(mockQuickPlay);

      renderWithRouter(<BattleLobbyPage />);

      const quickPlayButton = screen.getByRole('button', { name: /quick play/i });
      await user.click(quickPlayButton);

      expect(await screen.findByText(/already have an active battle/i)).toBeInTheDocument();
    });

    it('should show error for network failures', async () => {
      const user = userEvent.setup();
      const mockQuickPlay = vi.fn().mockRejectedValue(
        new Error('Failed to connect to server')
      );

      vi.spyOn(battleApi, 'quickPlay').mockImplementation(mockQuickPlay);

      renderWithRouter(<BattleLobbyPage />);

      const quickPlayButton = screen.getByRole('button', { name: /quick play/i });
      await user.click(quickPlayButton);

      expect(await screen.findByText(/failed to connect to server/i)).toBeInTheDocument();
    });
  });
});

describe('BattleLobbyPage - Real-time Battle List Integration', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.clearAllMocks();

    // Default mock: no battles, connected, no error
    vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
      battles: [],
      isConnected: true,
      error: null
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Battle List Display', () => {
    it('should display empty state when no battles are available', () => {
      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: [],
        isConnected: true,
        error: null
      });

      renderWithRouter(<BattleLobbyPage />);

      expect(screen.getByText(/no open battles available/i)).toBeInTheDocument();
      expect(screen.getByText(/use quick play or create a new battle/i)).toBeInTheDocument();
    });

    it('should display list of open battles', () => {
      const mockBattles: LobbyBattle[] = [
        {
          battleId: 'b1',
          battleKey: 'ABC123',
          battleName: 'Epic Showdown',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user1',
              displayName: 'Player One',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        },
        {
          battleId: 'b2',
          battleKey: 'XYZ789',
          battleName: 'Quick Match',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user2',
              displayName: 'Player Two',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        }
      ];

      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: mockBattles,
        isConnected: true,
        error: null
      });

      renderWithRouter(<BattleLobbyPage />);

      expect(screen.getByText('Epic Showdown')).toBeInTheDocument();
      expect(screen.getByText('Quick Match')).toBeInTheDocument();
      expect(screen.getByText(/hosted by player one/i)).toBeInTheDocument();
      expect(screen.getByText(/hosted by player two/i)).toBeInTheDocument();
    });

    it('should display battle keys in battle cards', () => {
      const mockBattles: LobbyBattle[] = [
        {
          battleId: 'b1',
          battleKey: 'ABC123',
          battleName: 'Test Battle',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user1',
              displayName: 'Host Player',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        }
      ];

      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: mockBattles,
        isConnected: true,
        error: null
      });

      renderWithRouter(<BattleLobbyPage />);

      expect(screen.getByText(/ABC123/)).toBeInTheDocument();
    });

    it('should display battle count', () => {
      const mockBattles: LobbyBattle[] = [
        {
          battleId: 'b1',
          battleKey: 'ABC123',
          battleName: 'Battle 1',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user1',
              displayName: 'Player One',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        },
        {
          battleId: 'b2',
          battleKey: 'XYZ789',
          battleName: 'Battle 2',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user2',
              displayName: 'Player Two',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        }
      ];

      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: mockBattles,
        isConnected: true,
        error: null
      });

      renderWithRouter(<BattleLobbyPage />);

      expect(screen.getByText(/2.*battles?.*available/i)).toBeInTheDocument();
    });
  });

  describe('Connection Status', () => {
    it('should show connected status when socket is connected', () => {
      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: [],
        isConnected: true,
        error: null
      });

      renderWithRouter(<BattleLobbyPage />);

      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });

    it('should show disconnected status when socket is not connected', () => {
      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: [],
        isConnected: false,
        error: null
      });

      renderWithRouter(<BattleLobbyPage />);

      expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when socket connection fails', () => {
      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: [],
        isConnected: false,
        error: 'Failed to connect to lobby server'
      });

      renderWithRouter(<BattleLobbyPage />);

      expect(screen.getByText(/failed to connect to lobby server/i)).toBeInTheDocument();
    });

    it('should display error message when authentication fails', () => {
      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: [],
        isConnected: false,
        error: 'Authentication token not available'
      });

      renderWithRouter(<BattleLobbyPage />);

      expect(screen.getByText(/authentication token not available/i)).toBeInTheDocument();
    });
  });

  describe('Battle Card Interactions', () => {
    it('should call joinBattleByKey when battle card is clicked', async () => {
      const user = userEvent.setup();
      const mockBattles: LobbyBattle[] = [
        {
          battleId: 'b1',
          battleKey: 'ABC123',
          battleName: 'Clickable Battle',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user1',
              displayName: 'Host Player',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        }
      ];

      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: mockBattles,
        isConnected: true,
        error: null
      });

      const mockJoinBattleByKey = vi.fn().mockResolvedValue({
        success: true,
        battleId: 'b1',
        matchId: 'match-123',
        playerId: 'player2'
      });

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      // Click the battle card (using battle name as identifier)
      const battleCard = screen.getByText('Clickable Battle').closest('div[role="button"]');
      expect(battleCard).toBeInTheDocument();

      await user.click(battleCard!);

      expect(mockJoinBattleByKey).toHaveBeenCalledWith('ABC123');
    });

    it('should navigate to deployment after successfully joining from battle list', async () => {
      const user = userEvent.setup();
      const mockBattles: LobbyBattle[] = [
        {
          battleId: 'b1',
          battleKey: 'ABC123',
          battleName: 'Test Battle',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user1',
              displayName: 'Host Player',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        }
      ];

      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: mockBattles,
        isConnected: true,
        error: null
      });

      const mockJoinBattleByKey = vi.fn().mockResolvedValue({
        success: true,
        battleId: 'b1',
        matchId: 'match-456',
        playerId: 'player2'
      });

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const battleCard = screen.getByText('Test Battle').closest('div[role="button"]');
      await user.click(battleCard!);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/deployment?matchId=match-456&playerId=player2');
      });
    });

    it('should show error when joining battle from list fails', async () => {
      const user = userEvent.setup();
      const mockBattles: LobbyBattle[] = [
        {
          battleId: 'b1',
          battleKey: 'ABC123',
          battleName: 'Full Battle',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user1',
              displayName: 'Host Player',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        }
      ];

      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: mockBattles,
        isConnected: true,
        error: null
      });

      const mockJoinBattleByKey = vi.fn().mockRejectedValue(
        new BattleAlreadyFilledError('This battle has already started or is full')
      );

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const battleCard = screen.getByText('Full Battle').closest('div[role="button"]');
      await user.click(battleCard!);

      expect(await screen.findByText(/already started or is full/i)).toBeInTheDocument();
    });

    it('should disable battle cards during join operation', async () => {
      const user = userEvent.setup();
      const mockBattles: LobbyBattle[] = [
        {
          battleId: 'b1',
          battleKey: 'ABC123',
          battleName: 'Test Battle',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user1',
              displayName: 'Host Player',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        }
      ];

      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: mockBattles,
        isConnected: true,
        error: null
      });

      let resolveJoin: any;
      const mockJoinBattleByKey = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          resolveJoin = resolve;
        })
      );

      vi.spyOn(battleApi, 'joinBattleByKey').mockImplementation(mockJoinBattleByKey);

      renderWithRouter(<BattleLobbyPage />);

      const battleCard = screen.getByText('Test Battle').closest('div[role="button"]');
      await user.click(battleCard!);

      // Battle card should be disabled during join
      expect(battleCard).toHaveAttribute('aria-disabled', 'true');

      // Clean up
      resolveJoin({
        success: true,
        battleId: 'b1',
        matchId: 'match-1',
        playerId: 'player2'
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should update battle list when new battles are added', () => {
      const { rerender } = renderWithRouter(<BattleLobbyPage />);

      // Initially no battles
      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: [],
        isConnected: true,
        error: null
      });

      expect(screen.getByText(/no open battles available/i)).toBeInTheDocument();

      // New battle added
      const newBattle: LobbyBattle = {
        battleId: 'b1',
        battleKey: 'ABC123',
        battleName: 'New Battle',
        status: 'waiting',
        isPublic: true,
        players: {
          host: {
            userId: 'user1',
            displayName: 'New Host',
            joinedAt: new Date().toISOString()
          }
        },
        createdAt: new Date().toISOString()
      };

      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: [newBattle],
        isConnected: true,
        error: null
      });

      rerender(
        <BrowserRouter>
          <BattleLobbyPage />
        </BrowserRouter>
      );

      expect(screen.getByText('New Battle')).toBeInTheDocument();
      expect(screen.queryByText(/no open battles available/i)).not.toBeInTheDocument();
    });

    it('should update battle list when battles are removed', () => {
      const battle: LobbyBattle = {
        battleId: 'b1',
        battleKey: 'ABC123',
        battleName: 'Temporary Battle',
        status: 'waiting',
        isPublic: true,
        players: {
          host: {
            userId: 'user1',
            displayName: 'Host',
            joinedAt: new Date().toISOString()
          }
        },
        createdAt: new Date().toISOString()
      };

      // Initially has battle
      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: [battle],
        isConnected: true,
        error: null
      });

      const { rerender } = renderWithRouter(<BattleLobbyPage />);

      expect(screen.getByText('Temporary Battle')).toBeInTheDocument();

      // Battle removed
      vi.spyOn(useLobbySocketModule, 'useLobbySocket').mockReturnValue({
        battles: [],
        isConnected: true,
        error: null
      });

      rerender(
        <BrowserRouter>
          <BattleLobbyPage />
        </BrowserRouter>
      );

      expect(screen.queryByText('Temporary Battle')).not.toBeInTheDocument();
      expect(screen.getByText(/no open battles available/i)).toBeInTheDocument();
    });
  });
});
