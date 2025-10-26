# L4 Task Breakdown: Battle Lobby API Integration

**Feature**: Battle Lobby API Integration & Real-time Updates
**Parent L3**: LOBBY-001 (Battle Lobby System)
**Dependencies**: Phase 1 (Authentication) Complete
**Created**: 2025-01-26
**Status**: Ready for Implementation

---

## Overview

Integrate the Battle Lobby frontend with backend APIs and implement real-time battle list updates via Socket.IO. This enables users to create battles, join by key, use quick play, and see live battle availability.

**Current State**: Battle Lobby UI exists with placeholder functions
**Target State**: Fully functional battle lobby with real API calls and live updates

---

## Implementation Strategy

### Phase A: API Client Foundation (Frontend)
Build the HTTP API client for battle operations

### Phase B: Battle Lobby Integration (Frontend)
Connect UI to API client with error handling

### Phase C: Real-time Socket Integration (Frontend + Backend)
Implement Socket.IO for live battle list updates

### Phase D: Backend API Implementation
Build the actual backend endpoints (separate from this frontend work)

**Note**: Phase D (Backend) should be implemented FIRST, but we're defining the frontend integration tasks here. This document assumes backend APIs will be available.

---

## PHASE A: API Client Foundation

### L4-LOBBY-API-001: Battle API Client Service

**Description**: Create TypeScript service for making HTTP requests to battle endpoints

**User Story**: As a frontend developer, I want a typed API client so that I can make battle requests with proper error handling.

**Acceptance Criteria**:
- [x] TypeScript interface for Battle type
- [ ] TypeScript interface for CreateBattleRequest
- [ ] TypeScript interface for CreateBattleResponse
- [ ] TypeScript interface for JoinBattleResponse
- [ ] TypeScript interface for QuickPlayResponse
- [ ] TypeScript interface for BattleListResponse
- [ ] Function: `createBattle(name: string, isPublic: boolean): Promise<CreateBattleResponse>`
- [ ] Function: `joinBattleByKey(battleKey: string): Promise<JoinBattleResponse>`
- [ ] Function: `quickPlay(): Promise<QuickPlayResponse>`
- [ ] Function: `getOpenBattles(page?: number): Promise<BattleListResponse>`
- [ ] Includes Authorization header with user token
- [ ] Throws typed errors for API failures
- [ ] All unit tests pass (mocked fetch)

**Test Cases**:
```typescript
describe('BattleAPI', () => {
  it('should create battle with name', async () => {
    mockFetch({ battleId: 'test-id', battleKey: 'ABC123', matchId: 'match-1', playerId: 'player1' });

    const result = await createBattle('My Battle', true);

    expect(result.battleKey).toBe('ABC123');
    expect(result.matchId).toBe('match-1');
    expect(fetch).toHaveBeenCalledWith('/api/battles', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ battleName: 'My Battle', isPublic: true })
    }));
  });

  it('should include auth token in requests', async () => {
    mockGetIdToken('test-token');
    mockFetch({ success: true });

    await createBattle('Test', true);

    const fetchCall = (fetch as jest.Mock).mock.calls[0][1];
    expect(fetchCall.headers.Authorization).toBe('Bearer test-token');
  });

  it('should throw error for insufficient creatures', async () => {
    mockFetch({ error: 'INSUFFICIENT_CREATURES' }, 400);

    await expect(createBattle('Test', true)).rejects.toThrow('INSUFFICIENT_CREATURES');
  });

  it('should join battle by key', async () => {
    mockFetch({ battleId: 'test', matchId: 'match-1', playerId: 'player2' });

    const result = await joinBattleByKey('ABC123');

    expect(result.playerId).toBe('player2');
    expect(fetch).toHaveBeenCalledWith('/api/battles/ABC123/join', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('should validate battle key format', async () => {
    await expect(joinBattleByKey('invalid')).rejects.toThrow('Invalid battle key format');
  });

  it('should fetch open battles with pagination', async () => {
    mockFetch({ battles: [{ battleId: '1' }, { battleId: '2' }], page: 1, limit: 10, total: 2 });

    const result = await getOpenBattles(1);

    expect(result.battles).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith('/api/battles/open?page=1&limit=10');
  });

  it('should handle quick play joining existing battle', async () => {
    mockFetch({ action: 'joined', battleId: 'test', matchId: 'match-1', playerId: 'player2' });

    const result = await quickPlay();

    expect(result.action).toBe('joined');
    expect(result.playerId).toBe('player2');
  });

  it('should handle quick play creating new battle', async () => {
    mockFetch({ action: 'created', battleId: 'new', battleKey: 'XYZ789', matchId: 'match-2', playerId: 'player1' });

    const result = await quickPlay();

    expect(result.action).toBe('created');
    expect(result.playerId).toBe('player1');
  });
});
```

**Files to Create**:
- `frontend/src/services/battle-api.ts`
- `frontend/src/services/__tests__/battle-api.test.ts`
- `frontend/src/types/battle.ts` (if doesn't exist)

**Dependencies**:
- AuthContext (for getIdToken)
- Existing API_URL env var

**Estimated Time**: 3 hours

---

### L4-LOBBY-API-002: Custom Error Classes

**Description**: Create typed error classes for battle API failures

**User Story**: As a developer, I want typed errors so that I can handle specific failure cases gracefully.

**Acceptance Criteria**:
- [ ] `InsufficientCreaturesError` class extends Error
- [ ] `BattleNotFoundError` class extends Error
- [ ] `BattleAlreadyFilledError` class extends Error
- [ ] `CannotJoinOwnBattleError` class extends Error
- [ ] `ActiveBattleExistsError` class extends Error
- [ ] Helper function: `parseBattleApiError(response): BattleApiError`
- [ ] All error classes have proper `name` property
- [ ] All unit tests pass

**Test Cases**:
```typescript
describe('Battle API Errors', () => {
  it('should create InsufficientCreaturesError', () => {
    const error = new InsufficientCreaturesError('Need 3 creatures');
    expect(error.name).toBe('InsufficientCreaturesError');
    expect(error.message).toBe('Need 3 creatures');
  });

  it('should parse API error response', () => {
    const response = { error: 'INSUFFICIENT_CREATURES', message: 'Need 3 creatures' };
    const error = parseBattleApiError(response);
    expect(error).toBeInstanceOf(InsufficientCreaturesError);
  });

  it('should handle unknown error codes', () => {
    const response = { error: 'UNKNOWN_ERROR' };
    const error = parseBattleApiError(response);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('UNKNOWN_ERROR');
  });
});
```

**Files to Create**:
- `frontend/src/services/battle-api-errors.ts`
- `frontend/src/services/__tests__/battle-api-errors.test.ts`

**Dependencies**: None

**Estimated Time**: 1 hour

---

## PHASE B: Battle Lobby Integration

### L4-LOBBY-UI-001: Integrate Create Battle with API

**Description**: Connect "Create Battle" modal to actual API call

**User Story**: As a user, I want to create a battle so that I can invite others to join.

**Acceptance Criteria**:
- [ ] Create Battle button calls `createBattle()` API
- [ ] Shows loading spinner during API call
- [ ] Navigates to `/deployment?matchId=X&playerId=player1` on success
- [ ] Shows error toast if insufficient creatures
- [ ] Shows error toast if active battle exists
- [ ] Shows error toast for network failures
- [ ] Modal closes on successful creation
- [ ] All integration tests pass

**Test Cases**:
```typescript
describe('BattleLobbyPage - Create Battle', () => {
  it('should call API when creating battle', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      battleId: 'test',
      battleKey: 'ABC123',
      matchId: 'match-1',
      playerId: 'player1'
    });
    mockBattleAPI({ createBattle: mockCreate });

    render(<BattleLobbyPage />);

    await userEvent.click(screen.getByText('Create Battle'));
    await userEvent.type(screen.getByPlaceholderText('Epic Showdown'), 'My Battle');
    await userEvent.click(screen.getByText('Create'));

    expect(mockCreate).toHaveBeenCalledWith('My Battle', true);
  });

  it('should navigate to deployment on success', async () => {
    mockBattleAPI({
      createBattle: jest.fn().mockResolvedValue({ matchId: 'match-1', playerId: 'player1' })
    });
    const navigate = jest.fn();
    mockUseNavigate(navigate);

    render(<BattleLobbyPage />);

    await userEvent.click(screen.getByText('Create Battle'));
    await userEvent.type(screen.getByPlaceholderText('Epic Showdown'), 'Test');
    await userEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/deployment?matchId=match-1&playerId=player1');
    });
  });

  it('should show error for insufficient creatures', async () => {
    mockBattleAPI({
      createBattle: jest.fn().mockRejectedValue(new InsufficientCreaturesError('Need 3'))
    });

    render(<BattleLobbyPage />);

    await userEvent.click(screen.getByText('Create Battle'));
    await userEvent.type(screen.getByPlaceholderText('Epic Showdown'), 'Test');
    await userEvent.click(screen.getByText('Create'));

    expect(await screen.findByText(/need at least 3 creatures/i)).toBeInTheDocument();
  });

  it('should show loading state during creation', async () => {
    mockBattleAPI({
      createBattle: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
    });

    render(<BattleLobbyPage />);

    await userEvent.click(screen.getByText('Create Battle'));
    await userEvent.type(screen.getByPlaceholderText('Epic Showdown'), 'Test');
    await userEvent.click(screen.getByText('Create'));

    expect(screen.getByText('Creating...')).toBeInTheDocument();
  });
});
```

**Files to Modify**:
- `frontend/src/pages/BattleLobbyPage.tsx`

**Files to Create**:
- `frontend/src/components/common/Toast.tsx` (if doesn't exist)

**Dependencies**: L4-LOBBY-API-001, L4-LOBBY-API-002

**Estimated Time**: 2 hours

---

### L4-LOBBY-UI-002: Integrate Join by Key with API

**Description**: Connect "Join by Key" input to actual API call

**User Story**: As a user, I want to join a friend's battle using their battle key.

**Acceptance Criteria**:
- [ ] Join button calls `joinBattleByKey()` API
- [ ] Validates key format (6 uppercase alphanumeric)
- [ ] Shows loading spinner during API call
- [ ] Navigates to `/deployment?matchId=X&playerId=player2` on success
- [ ] Shows error if battle not found
- [ ] Shows error if battle already full
- [ ] Shows error if trying to join own battle
- [ ] Shows error if insufficient creatures
- [ ] Clears input on successful join
- [ ] All integration tests pass

**Test Cases**:
```typescript
describe('BattleLobbyPage - Join by Key', () => {
  it('should join battle with valid key', async () => {
    const mockJoin = jest.fn().mockResolvedValue({
      battleId: 'test',
      matchId: 'match-1',
      playerId: 'player2'
    });
    mockBattleAPI({ joinBattleByKey: mockJoin });

    render(<BattleLobbyPage />);

    await userEvent.type(screen.getByPlaceholderText('K3P9X2'), 'ABC123');
    await userEvent.click(screen.getByText('Join'));

    expect(mockJoin).toHaveBeenCalledWith('ABC123');
  });

  it('should navigate to deployment on success', async () => {
    mockBattleAPI({
      joinBattleByKey: jest.fn().mockResolvedValue({ matchId: 'match-1', playerId: 'player2' })
    });
    const navigate = jest.fn();
    mockUseNavigate(navigate);

    render(<BattleLobbyPage />);

    await userEvent.type(screen.getByPlaceholderText('K3P9X2'), 'ABC123');
    await userEvent.click(screen.getByText('Join'));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/deployment?matchId=match-1&playerId=player2');
    });
  });

  it('should show error for invalid key format', async () => {
    render(<BattleLobbyPage />);

    await userEvent.type(screen.getByPlaceholderText('K3P9X2'), 'invalid');
    await userEvent.click(screen.getByText('Join'));

    expect(await screen.findByText(/invalid battle key format/i)).toBeInTheDocument();
  });

  it('should show error if battle not found', async () => {
    mockBattleAPI({
      joinBattleByKey: jest.fn().mockRejectedValue(new BattleNotFoundError('Not found'))
    });

    render(<BattleLobbyPage />);

    await userEvent.type(screen.getByPlaceholderText('K3P9X2'), 'ABC123');
    await userEvent.click(screen.getByText('Join'));

    expect(await screen.findByText(/battle not found/i)).toBeInTheDocument();
  });

  it('should disable join button for invalid key length', () => {
    render(<BattleLobbyPage />);

    const joinButton = screen.getByText('Join');
    expect(joinButton).toBeDisabled();

    userEvent.type(screen.getByPlaceholderText('K3P9X2'), 'ABC');
    expect(joinButton).toBeDisabled();

    userEvent.type(screen.getByPlaceholderText('K3P9X2'), '123');
    expect(joinButton).toBeEnabled();
  });
});
```

**Files to Modify**:
- `frontend/src/pages/BattleLobbyPage.tsx`

**Dependencies**: L4-LOBBY-API-001, L4-LOBBY-API-002

**Estimated Time**: 2 hours

---

### L4-LOBBY-UI-003: Integrate Quick Play with API

**Description**: Connect "Quick Play" button to actual API call

**User Story**: As a user, I want to quickly find a battle without manual setup.

**Acceptance Criteria**:
- [ ] Quick Play button calls `quickPlay()` API
- [ ] Shows loading spinner during API call
- [ ] Navigates to deployment with correct playerId (player1 or player2)
- [ ] Shows "Searching..." then "Match found!" or "Creating battle..." messages
- [ ] Shows error if insufficient creatures
- [ ] Shows error if active battle exists
- [ ] Button disabled during loading
- [ ] All integration tests pass

**Test Cases**:
```typescript
describe('BattleLobbyPage - Quick Play', () => {
  it('should join existing battle', async () => {
    const mockQuickPlay = jest.fn().mockResolvedValue({
      action: 'joined',
      matchId: 'match-1',
      playerId: 'player2'
    });
    mockBattleAPI({ quickPlay: mockQuickPlay });

    render(<BattleLobbyPage />);

    await userEvent.click(screen.getByText('Quick Play'));

    expect(mockQuickPlay).toHaveBeenCalled();
    expect(await screen.findByText(/match found/i)).toBeInTheDocument();
  });

  it('should create new battle if none available', async () => {
    mockBattleAPI({
      quickPlay: jest.fn().mockResolvedValue({
        action: 'created',
        matchId: 'match-1',
        playerId: 'player1',
        battleKey: 'ABC123'
      })
    });

    render(<BattleLobbyPage />);

    await userEvent.click(screen.getByText('Quick Play'));

    expect(await screen.findByText(/waiting for opponent/i)).toBeInTheDocument();
  });

  it('should navigate with correct playerId', async () => {
    mockBattleAPI({
      quickPlay: jest.fn().mockResolvedValue({
        action: 'joined',
        matchId: 'match-1',
        playerId: 'player2'
      })
    });
    const navigate = jest.fn();
    mockUseNavigate(navigate);

    render(<BattleLobbyPage />);

    await userEvent.click(screen.getByText('Quick Play'));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/deployment?matchId=match-1&playerId=player2');
    });
  });

  it('should disable button during loading', async () => {
    mockBattleAPI({
      quickPlay: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
    });

    render(<BattleLobbyPage />);

    const button = screen.getByText('Quick Play');
    await userEvent.click(button);

    expect(button).toBeDisabled();
  });
});
```

**Files to Modify**:
- `frontend/src/pages/BattleLobbyPage.tsx`

**Dependencies**: L4-LOBBY-API-001, L4-LOBBY-API-002

**Estimated Time**: 2 hours

---

## PHASE C: Real-time Socket Integration

### L4-LOBBY-SOCKET-001: Lobby Socket Service

**Description**: Create Socket.IO client for lobby namespace with typed events

**User Story**: As a frontend developer, I want a Socket.IO client so that I can receive real-time battle updates.

**Acceptance Criteria**:
- [ ] LobbySocket class with singleton pattern
- [ ] Method: `connect(): void` - Establishes Socket.IO connection to `/lobby`
- [ ] Method: `disconnect(): void` - Closes connection
- [ ] Method: `subscribe(): void` - Emits 'lobby:subscribe' event
- [ ] Method: `unsubscribe(): void` - Emits 'lobby:unsubscribe' event
- [ ] Method: `onBattles(callback): void` - Listen for 'lobby:battles' event
- [ ] Method: `onBattleCreated(callback): void` - Listen for 'lobby:battle-created'
- [ ] Method: `onBattleFilled(callback): void` - Listen for 'lobby:battle-filled'
- [ ] Method: `onBattleCancelled(callback): void` - Listen for 'lobby:battle-cancelled'
- [ ] Includes auth token in connection handshake
- [ ] Auto-reconnect on disconnect
- [ ] All unit tests pass (mocked socket)

**Test Cases**:
```typescript
describe('LobbySocket', () => {
  it('should connect to /lobby namespace', () => {
    const socket = new LobbySocket();
    socket.connect();

    expect(io).toHaveBeenCalledWith(expect.stringContaining('/lobby'), expect.any(Object));
  });

  it('should include auth token in connection', async () => {
    mockGetIdToken('test-token');
    const socket = new LobbySocket();
    socket.connect();

    const ioCall = (io as jest.Mock).mock.calls[0][1];
    const authCallback = jest.fn();
    await ioCall.auth(authCallback);

    expect(authCallback).toHaveBeenCalledWith({ token: 'test-token' });
  });

  it('should subscribe on connection', () => {
    const mockSocket = createMockSocket();
    (io as jest.Mock).mockReturnValue(mockSocket);

    const socket = new LobbySocket();
    socket.connect();

    mockSocket.emit('connect');

    expect(mockSocket.emit).toHaveBeenCalledWith('lobby:subscribe');
  });

  it('should call callback on battle-created event', () => {
    const mockSocket = createMockSocket();
    (io as jest.Mock).mockReturnValue(mockSocket);
    const callback = jest.fn();

    const socket = new LobbySocket();
    socket.connect();
    socket.onBattleCreated(callback);

    mockSocket.emit('lobby:battle-created', { battleId: 'test' });

    expect(callback).toHaveBeenCalledWith({ battleId: 'test' });
  });

  it('should disconnect and unsubscribe', () => {
    const mockSocket = createMockSocket();
    (io as jest.Mock).mockReturnValue(mockSocket);

    const socket = new LobbySocket();
    socket.connect();
    socket.disconnect();

    expect(mockSocket.emit).toHaveBeenCalledWith('lobby:unsubscribe');
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
```

**Files to Create**:
- `frontend/src/services/lobby-socket.ts`
- `frontend/src/services/__tests__/lobby-socket.test.ts`

**Dependencies**:
- socket.io-client package
- AuthContext for token

**Estimated Time**: 3 hours

---

### L4-LOBBY-SOCKET-002: useLobbySocket Hook

**Description**: React hook for managing lobby socket connection lifecycle

**User Story**: As a frontend developer, I want a React hook so that I can easily use lobby socket in components.

**Acceptance Criteria**:
- [ ] Hook: `useLobbySocket()` returns `{ battles, isConnected, error }`
- [ ] Connects to lobby socket on mount
- [ ] Subscribes to lobby updates on connection
- [ ] Unsubscribes and disconnects on unmount
- [ ] Updates `battles` state when 'lobby:battles' event received
- [ ] Adds battle to list on 'lobby:battle-created' event
- [ ] Removes battle from list on 'lobby:battle-filled' event
- [ ] Removes battle from list on 'lobby:battle-cancelled' event
- [ ] Sets `isConnected` based on socket state
- [ ] Sets `error` if connection fails
- [ ] All unit tests pass

**Test Cases**:
```typescript
describe('useLobbySocket', () => {
  it('should connect on mount', () => {
    const mockConnect = jest.fn();
    mockLobbySocket({ connect: mockConnect });

    renderHook(() => useLobbySocket());

    expect(mockConnect).toHaveBeenCalled();
  });

  it('should disconnect on unmount', () => {
    const mockDisconnect = jest.fn();
    mockLobbySocket({ disconnect: mockDisconnect });

    const { unmount } = renderHook(() => useLobbySocket());
    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should update battles on lobby:battles event', () => {
    const mockSocket = createMockLobbySocket();

    const { result } = renderHook(() => useLobbySocket());

    act(() => {
      mockSocket.triggerEvent('lobby:battles', [
        { battleId: '1', battleName: 'Battle 1' },
        { battleId: '2', battleName: 'Battle 2' }
      ]);
    });

    expect(result.current.battles).toHaveLength(2);
  });

  it('should add battle on battle-created event', () => {
    const mockSocket = createMockLobbySocket();

    const { result } = renderHook(() => useLobbySocket());

    act(() => {
      mockSocket.triggerEvent('lobby:battles', []);
      mockSocket.triggerEvent('lobby:battle-created', { battleId: '1', battleName: 'New Battle' });
    });

    expect(result.current.battles).toHaveLength(1);
    expect(result.current.battles[0].battleId).toBe('1');
  });

  it('should remove battle on battle-filled event', () => {
    const mockSocket = createMockLobbySocket();

    const { result } = renderHook(() => useLobbySocket());

    act(() => {
      mockSocket.triggerEvent('lobby:battles', [
        { battleId: '1', battleName: 'Battle 1' },
        { battleId: '2', battleName: 'Battle 2' }
      ]);
      mockSocket.triggerEvent('lobby:battle-filled', { battleId: '1' });
    });

    expect(result.current.battles).toHaveLength(1);
    expect(result.current.battles[0].battleId).toBe('2');
  });

  it('should set connected state', () => {
    const mockSocket = createMockLobbySocket();

    const { result } = renderHook(() => useLobbySocket());

    expect(result.current.isConnected).toBe(false);

    act(() => {
      mockSocket.triggerEvent('connect');
    });

    expect(result.current.isConnected).toBe(true);
  });
});
```

**Files to Create**:
- `frontend/src/hooks/useLobbySocket.ts`
- `frontend/src/hooks/__tests__/useLobbySocket.test.ts`

**Dependencies**: L4-LOBBY-SOCKET-001

**Estimated Time**: 2 hours

---

### L4-LOBBY-UI-004: Integrate Real-time Battle List

**Description**: Display live battle list using useLobbySocket hook

**User Story**: As a user, I want to see open battles update in real-time so that I don't miss opportunities.

**Acceptance Criteria**:
- [ ] "Browse Open Battles" section uses `useLobbySocket()` hook
- [ ] Shows loading state while connecting to socket
- [ ] Shows list of open battles from socket
- [ ] Each battle card shows: name, host, time ago, battle key
- [ ] Each battle card has "Join" button
- [ ] Join button calls `joinBattleByKey()` with battle's key
- [ ] Battle disappears from list when filled
- [ ] Shows "No open battles" empty state
- [ ] Shows connection error if socket fails
- [ ] All integration tests pass

**Test Cases**:
```typescript
describe('BattleLobbyPage - Browse Battles', () => {
  it('should display battles from socket', () => {
    mockUseLobbySocket({
      battles: [
        { battleId: '1', battleName: 'Epic Battle', battleKey: 'ABC123', players: { host: { displayName: 'Player1' } } },
        { battleId: '2', battleName: 'Quick Match', battleKey: 'XYZ789', players: { host: { displayName: 'Player2' } } }
      ],
      isConnected: true
    });

    render(<BattleLobbyPage />);

    expect(screen.getByText('Epic Battle')).toBeInTheDocument();
    expect(screen.getByText('Quick Match')).toBeInTheDocument();
    expect(screen.getByText('Hosted by Player1')).toBeInTheDocument();
  });

  it('should show empty state when no battles', () => {
    mockUseLobbySocket({ battles: [], isConnected: true });

    render(<BattleLobbyPage />);

    expect(screen.getByText(/no open battles/i)).toBeInTheDocument();
  });

  it('should join battle when clicking join button', async () => {
    const mockJoin = jest.fn().mockResolvedValue({ matchId: 'match-1', playerId: 'player2' });
    mockBattleAPI({ joinBattleByKey: mockJoin });
    mockUseLobbySocket({
      battles: [
        { battleId: '1', battleName: 'Test', battleKey: 'ABC123', players: { host: { displayName: 'Host' } } }
      ],
      isConnected: true
    });

    render(<BattleLobbyPage />);

    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(mockJoin).toHaveBeenCalledWith('ABC123');
  });

  it('should show loading state while connecting', () => {
    mockUseLobbySocket({ battles: [], isConnected: false });

    render(<BattleLobbyPage />);

    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('should show error if socket connection fails', () => {
    mockUseLobbySocket({ battles: [], isConnected: false, error: 'Connection failed' });

    render(<BattleLobbyPage />);

    expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
  });

  it('should update when new battle is created', async () => {
    const mockSocket = createDynamicLobbySocket();
    mockUseLobbySocket(mockSocket);

    render(<BattleLobbyPage />);

    expect(screen.queryByText('New Battle')).not.toBeInTheDocument();

    act(() => {
      mockSocket.addBattle({ battleId: '1', battleName: 'New Battle', battleKey: 'NEW123', players: { host: { displayName: 'NewHost' } } });
    });

    expect(screen.getByText('New Battle')).toBeInTheDocument();
  });
});
```

**Files to Modify**:
- `frontend/src/pages/BattleLobbyPage.tsx`

**Files to Create**:
- `frontend/src/components/BattleLobby/BattleCard.tsx` (optional, for cleaner code)

**Dependencies**: L4-LOBBY-SOCKET-002, L4-LOBBY-API-001

**Estimated Time**: 3 hours

---

## Implementation Order

**Recommended sequence for TDD implementation:**

1. ✅ **L4-LOBBY-API-002** (1 hour) - Error classes first, needed by API client
2. ✅ **L4-LOBBY-API-001** (3 hours) - Core API client with all endpoints
3. ✅ **L4-LOBBY-UI-001** (2 hours) - Create Battle integration
4. ✅ **L4-LOBBY-UI-002** (2 hours) - Join by Key integration
5. ✅ **L4-LOBBY-UI-003** (2 hours) - Quick Play integration
6. ✅ **L4-LOBBY-SOCKET-001** (3 hours) - Socket service
7. ✅ **L4-LOBBY-SOCKET-002** (2 hours) - Socket hook
8. ✅ **L4-LOBBY-UI-004** (3 hours) - Live battle list

**Total Frontend Work**: ~18 hours (2.5 days)

---

## Backend Dependencies

**CRITICAL**: These frontend tasks assume the following backend work is completed:

1. **POST /api/battles** - Create battle endpoint
2. **POST /api/battles/:key/join** - Join battle endpoint
3. **POST /api/battles/quick-play** - Quick play endpoint
4. **GET /api/battles/open** - List open battles endpoint
5. **Socket.IO /lobby namespace** - Real-time battle updates
6. **Battle key generation** - 6-character unique keys
7. **Creature count validation** - Minimum 3 creatures check
8. **Active battle middleware** - Prevent multiple concurrent battles

If backend is not ready, we can:
- Mock all API responses for frontend development
- Test with demo mode only
- Deploy frontend changes when backend is ready

---

## Testing Strategy

### Unit Tests
- Mock all HTTP fetch calls
- Mock Socket.IO connections
- Test error handling for each failure case
- Test loading states
- Test navigation after success

### Integration Tests
- Test full user flows (create → join → deploy)
- Test error recovery (retry after failure)
- Test socket reconnection
- Test concurrent battle list updates

### E2E Tests (Manual for now)
- Create battle → copy key → join from another browser
- Quick Play → verify deployment navigation
- Join by key → verify correct playerId assignment

---

## Success Metrics

- All unit tests passing (target: 100% coverage for API client)
- API calls include proper authentication
- Error messages are user-friendly
- Loading states prevent duplicate requests
- Socket connection is stable (auto-reconnect works)
- Battle list updates without page refresh

---

## Security Considerations

- ✅ All API requests include Authorization header
- ✅ Battle key validation happens on both client and server
- ✅ Socket.IO auth token included in handshake
- ⚠️ Never expose internal battleId in URLs (use battleKey or matchId)
- ⚠️ Validate all user inputs before API calls
- ⚠️ Handle token expiration gracefully

---

## Next Steps After Completion

Once Battle Lobby API Integration is complete:
1. **Backend API Implementation** - Build the actual endpoints
2. **Creature Count Endpoint** - `/api/users/me/creatures/count`
3. **Battle History Tracking** - Record when battles start/complete
4. **Battle Spectator Mode** - Watch ongoing battles
5. **Battle Invitations** - Send direct invites to friends

---

## Related Documents

- L3 Spec: `docs/specs/L3-FEATURES/homepage-hub/battle-lobby-system.md`
- Backend API Spec: (in battle-lobby-system.md, lines 320-691)
- Socket.IO Spec: (in battle-lobby-system.md, lines 700-800)
