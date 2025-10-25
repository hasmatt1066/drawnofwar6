# L4 Task Breakdown: Homepage Hub & Battle Lobby System

**Feature**: Homepage Hub & Battle Lobby System
**L3 Specs**: AUTH-001, HOME-001, LOBBY-001, STATS-001
**Created**: 2025-10-25
**Status**: Ready for Implementation

---

## Implementation Phases

This feature will be implemented in 4 sequential phases over 4 weeks:

1. **Phase 1: Foundation (Firebase Auth)** - Week 1
2. **Phase 2: Homepage Hub UI** - Week 2
3. **Phase 3: Battle Lobby System** - Week 2-3
4. **Phase 4: Stats Tracking** - Week 3-4

Each task is designed to be:
- Completed in 2-4 hours
- Unit-testable in isolation
- TDD-compatible (test first, then implement)
- Deployable incrementally

---

## PHASE 1: Firebase Auth Integration (Week 1)

**Dependencies**: None (foundation layer)
**Estimated Time**: 5 days (8 tasks)

---

### L4-AUTH-001: Backend Auth Middleware

**Description**: Implement Firebase token verification middleware for backend API routes

**User Story**: As a backend developer, I want to verify Firebase ID tokens on protected routes so that only authenticated users can access them.

**Acceptance Criteria**:
- [ ] Middleware extracts Bearer token from Authorization header
- [ ] Middleware verifies token using Firebase Admin SDK
- [ ] Valid token → sets req.user with { uid, email, displayName }
- [ ] Invalid token → returns 401 with error message
- [ ] Missing token → returns 401 with error message
- [ ] Demo accounts ('demo-player1', 'demo-player2') bypass verification for testing
- [ ] All unit tests pass (100% coverage)

**Test Cases**:
```typescript
describe('authenticate middleware', () => {
  it('should verify valid Firebase token', async () => {
    const token = await generateValidToken();
    const req = mockRequest({ authorization: `Bearer ${token}` });
    await authenticate(req, res, next);
    expect(req.user).toBeDefined();
    expect(req.user.uid).toBe('test-user-id');
    expect(next).toHaveBeenCalled();
  });

  it('should reject invalid token', async () => {
    const req = mockRequest({ authorization: 'Bearer invalid-token' });
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject missing token', async () => {
    const req = mockRequest({});
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should allow demo accounts', async () => {
    const req = mockRequest({ authorization: 'Bearer demo-player1' });
    await authenticate(req, res, next);
    expect(req.user.uid).toBe('demo-player1');
    expect(next).toHaveBeenCalled();
  });
});
```

**Files to Create**:
- `backend/src/middleware/auth.middleware.ts`
- `backend/src/middleware/__tests__/auth.middleware.test.ts`

**Dependencies**: Firebase Admin SDK (already installed)

**Estimated Time**: 3 hours

---

### L4-AUTH-002: User Profile Creation Endpoint

**Description**: API endpoint to create user profile in Firestore after Firebase registration

**User Story**: As a new user, I want my profile automatically created when I register so that my stats and data are tracked.

**Acceptance Criteria**:
- [ ] POST /api/users/profile endpoint exists
- [ ] Requires authentication (uses auth middleware)
- [ ] Creates document at `users/{userId}/profile` in Firestore
- [ ] Initializes stats to zero (wins, losses, totalBattles, streaks)
- [ ] Stores displayName, email, createdAt, lastLoginAt
- [ ] Returns 201 on success
- [ ] Returns 400 if profile already exists
- [ ] All unit tests pass

**Test Cases**:
```typescript
describe('POST /api/users/profile', () => {
  it('should create new user profile', async () => {
    const response = await request(app)
      .post('/api/users/profile')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ displayName: 'Test User' })
      .expect(201);

    const profile = await firestore.doc('users/test-uid/profile').get();
    expect(profile.exists).toBe(true);
    expect(profile.data().stats.wins).toBe(0);
  });

  it('should reject unauthenticated request', async () => {
    await request(app)
      .post('/api/users/profile')
      .send({ displayName: 'Test' })
      .expect(401);
  });

  it('should reject duplicate profile creation', async () => {
    await createProfile('test-uid');
    await request(app)
      .post('/api/users/profile')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ displayName: 'Test' })
      .expect(400);
  });
});
```

**Files to Create**:
- `backend/src/api/routes/users.routes.ts`
- `backend/src/api/controllers/users.controller.ts`
- `backend/src/api/__tests__/users.routes.test.ts`

**Dependencies**: L4-AUTH-001 (auth middleware)

**Estimated Time**: 3 hours

---

### L4-AUTH-003: Frontend Firebase Config

**Description**: Initialize Firebase SDK on frontend with environment configuration

**User Story**: As a frontend developer, I want Firebase initialized correctly so that I can use authentication services.

**Acceptance Criteria**:
- [ ] Firebase app initialized with config from env vars
- [ ] Auth instance exported for use in app
- [ ] Emulator connection works in development mode
- [ ] Config validates required env vars on startup
- [ ] No errors in console on initialization
- [ ] Integration test verifies Firebase connection

**Test Cases**:
```typescript
describe('Firebase Config', () => {
  it('should initialize Firebase app', () => {
    expect(app).toBeDefined();
    expect(auth).toBeDefined();
  });

  it('should throw error if missing API key', () => {
    delete process.env.VITE_FIREBASE_API_KEY;
    expect(() => initializeFirebase()).toThrow('Missing VITE_FIREBASE_API_KEY');
  });

  it('should connect to emulator in development', () => {
    process.env.VITE_ENV = 'development';
    initializeFirebase();
    expect(auth._delegate._emulator).toBeDefined();
  });
});
```

**Files to Create**:
- `frontend/src/config/firebase.ts`
- `frontend/src/config/__tests__/firebase.test.ts`

**Dependencies**: None (env vars already in .env.example)

**Estimated Time**: 2 hours

---

### L4-AUTH-004: Auth Context Provider

**Description**: React context provider for authentication state management

**User Story**: As a frontend developer, I want centralized auth state management so that all components can access user data.

**Acceptance Criteria**:
- [ ] AuthContext created with TypeScript types
- [ ] Provides: user, loading, signUp, signIn, signOut, getIdToken
- [ ] Listens to onAuthStateChanged from Firebase
- [ ] Token refreshes automatically every 50 minutes
- [ ] User state updates on login/logout
- [ ] Loading state managed correctly
- [ ] All unit tests pass

**Test Cases**:
```typescript
describe('AuthProvider', () => {
  it('should provide null user when not signed in', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    });
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should update user on sign in', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    });

    await act(async () => {
      await result.current.signIn('test@test.com', 'password');
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.user.email).toBe('test@test.com');
  });

  it('should refresh token every 50 minutes', async () => {
    jest.useFakeTimers();
    renderHook(() => useAuth(), { wrapper: AuthProvider });

    const getIdToken = jest.spyOn(auth.currentUser, 'getIdToken');

    jest.advanceTimersByTime(50 * 60 * 1000);

    expect(getIdToken).toHaveBeenCalledWith(true);
    jest.useRealTimers();
  });
});
```

**Files to Create**:
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/contexts/__tests__/AuthContext.test.tsx`
- `frontend/src/hooks/useAuth.ts`

**Dependencies**: L4-AUTH-003 (Firebase config)

**Estimated Time**: 4 hours

---

### L4-AUTH-005: Protected Route Component

**Description**: React component wrapper to protect routes requiring authentication

**User Story**: As a user, I want to be redirected to login when accessing protected pages without being signed in.

**Acceptance Criteria**:
- [ ] ProtectedRoute component created
- [ ] Shows loading spinner while checking auth state
- [ ] Redirects to /login if not authenticated
- [ ] Preserves intended destination in location state
- [ ] Renders children if authenticated
- [ ] All unit tests pass

**Test Cases**:
```typescript
describe('ProtectedRoute', () => {
  it('should render children when authenticated', () => {
    mockUseAuth({ user: { uid: 'test' }, loading: false });
    const { getByText } = render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', () => {
    mockUseAuth({ user: null, loading: false });
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={
            <ProtectedRoute><div>Home</div></ProtectedRoute>
          } />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('should show loading spinner while checking auth', () => {
    mockUseAuth({ user: null, loading: true });
    const { getByTestId } = render(<ProtectedRoute><div>Content</div></ProtectedRoute>);
    expect(getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

**Files to Create**:
- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/src/components/__tests__/ProtectedRoute.test.tsx`

**Dependencies**: L4-AUTH-004 (Auth context)

**Estimated Time**: 2 hours

---

### L4-AUTH-006: Login Page UI

**Description**: Login page with email/password form

**User Story**: As a user, I want to log in with my email and password so that I can access my account.

**Acceptance Criteria**:
- [ ] Login form with email and password fields
- [ ] "Log In" button calls signIn from auth context
- [ ] Shows error message on invalid credentials
- [ ] Shows loading state during login
- [ ] Link to registration page
- [ ] Redirects to /home on successful login
- [ ] Form validation (email format, required fields)
- [ ] All unit tests pass

**Test Cases**:
```typescript
describe('LoginPage', () => {
  it('should render login form', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
  });

  it('should call signIn on form submit', async () => {
    const signIn = jest.fn();
    mockUseAuth({ signIn });

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(signIn).toHaveBeenCalledWith('test@test.com', 'password123');
  });

  it('should show error on invalid credentials', async () => {
    const signIn = jest.fn().mockRejectedValue({ code: 'auth/wrong-password' });
    mockUseAuth({ signIn });

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument();
  });
});
```

**Files to Create**:
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/LoginPage.css`
- `frontend/src/pages/__tests__/LoginPage.test.tsx`

**Dependencies**: L4-AUTH-004 (Auth context)

**Estimated Time**: 3 hours

---

### L4-AUTH-007: Register Page UI

**Description**: Registration page with email/password/displayName form

**User Story**: As a new user, I want to create an account so that I can start playing.

**Acceptance Criteria**:
- [ ] Registration form with displayName, email, password, confirmPassword
- [ ] "Create Account" button calls signUp from auth context
- [ ] Password confirmation validation
- [ ] Shows error messages for validation failures
- [ ] Shows loading state during registration
- [ ] Link to login page
- [ ] Creates user profile after successful registration
- [ ] Redirects to /home on success
- [ ] All unit tests pass

**Test Cases**:
```typescript
describe('RegisterPage', () => {
  it('should render registration form', () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
  });

  it('should validate password confirmation', async () => {
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'password456');
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('should call signUp on valid submission', async () => {
    const signUp = jest.fn();
    mockUseAuth({ signUp });

    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText('Display Name'), 'Test User');
    await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(signUp).toHaveBeenCalledWith('test@test.com', 'password123', 'Test User');
  });
});
```

**Files to Create**:
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/RegisterPage.css`
- `frontend/src/pages/__tests__/RegisterPage.test.tsx`

**Dependencies**: L4-AUTH-004 (Auth context), L4-AUTH-002 (profile creation endpoint)

**Estimated Time**: 3 hours

---

### L4-AUTH-008: E2E Auth Flow Test

**Description**: End-to-end test for complete authentication flow

**User Story**: As a QA tester, I want automated E2E tests for the auth flow so that I can verify it works end-to-end.

**Acceptance Criteria**:
- [ ] Test registers new user → creates profile → redirects to home
- [ ] Test logs out → redirects to login
- [ ] Test logs back in → maintains session
- [ ] Test protected route access without auth → redirects to login
- [ ] Test token refresh during long session
- [ ] All E2E tests pass

**Test Cases**:
```typescript
describe('E2E: Authentication Flow', () => {
  it('should complete full registration flow', async () => {
    // Visit register page
    await page.goto('/register');

    // Fill form
    await page.fill('[name="displayName"]', 'E2E Test User');
    await page.fill('[name="email"]', 'e2e@test.com');
    await page.fill('[name="password"]', 'testpass123');
    await page.fill('[name="confirmPassword"]', 'testpass123');

    // Submit
    await page.click('button[type="submit"]');

    // Verify redirected to home
    await page.waitForURL('/home');

    // Verify profile created
    const profile = await getFirestoreDoc('users/e2e-test-uid/profile');
    expect(profile.displayName).toBe('E2E Test User');
  });

  it('should persist session across page refresh', async () => {
    await login('test@test.com', 'password');
    await page.goto('/home');

    await page.reload();

    // Should still be on /home, not redirected to /login
    expect(page.url()).toContain('/home');
  });
});
```

**Files to Create**:
- `frontend/e2e/auth-flow.spec.ts`

**Dependencies**: All previous auth tasks

**Estimated Time**: 4 hours

---

## PHASE 2: Homepage Hub UI (Week 2)

**Dependencies**: Phase 1 (Auth) complete
**Estimated Time**: 5 days (8 tasks)

---

### L4-HOME-001: Persistent Navigation Bar Component

**Description**: Top navigation bar component appearing on all authenticated pages

**User Story**: As a user, I want a persistent navigation bar so that I can easily move between different sections of the app.

**Acceptance Criteria**:
- [ ] NavBar component renders logo and navigation links
- [ ] Links: Home, Gallery, Create
- [ ] User menu with avatar and dropdown
- [ ] Dropdown shows: Profile, Logout
- [ ] Active link highlighted
- [ ] Responsive (hamburger menu on mobile)
- [ ] Logout calls signOut from auth context
- [ ] All unit tests pass

**Test Cases**:
```typescript
describe('NavBar', () => {
  it('should render all navigation links', () => {
    render(<NavBar />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Gallery')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('should show user menu on avatar click', async () => {
    render(<NavBar />);
    await userEvent.click(screen.getByRole('img', { name: /avatar/i }));
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should call signOut on logout click', async () => {
    const signOut = jest.fn();
    mockUseAuth({ signOut });

    render(<NavBar />);
    await userEvent.click(screen.getByRole('img', { name: /avatar/i }));
    await userEvent.click(screen.getByText('Logout'));

    expect(signOut).toHaveBeenCalled();
  });

  it('should highlight active link', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <NavBar />
      </MemoryRouter>
    );
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveClass('active');
  });
});
```

**Files to Create**:
- `frontend/src/components/NavBar/NavBar.tsx`
- `frontend/src/components/NavBar/NavBar.css`
- `frontend/src/components/NavBar/__tests__/NavBar.test.tsx`

**Dependencies**: L4-AUTH-004 (Auth context)

**Estimated Time**: 3 hours

---

### L4-HOME-002: User Stats API Endpoint

**Description**: Backend endpoint to retrieve user's battle statistics

**User Story**: As a frontend developer, I want an API to fetch user stats so that I can display them on the homepage.

**Acceptance Criteria**:
- [ ] GET /api/users/me/stats endpoint exists
- [ ] Requires authentication
- [ ] Returns stats: wins, losses, totalBattles, currentWinStreak, bestWinStreak
- [ ] Returns 404 if profile doesn't exist
- [ ] Calculates win rate on backend
- [ ] All unit tests pass

**Test Cases**:
```typescript
describe('GET /api/users/me/stats', () => {
  it('should return user stats', async () => {
    await createUserProfile('test-uid', {
      stats: { wins: 5, losses: 3, totalBattles: 8 }
    });

    const response = await request(app)
      .get('/api/users/me/stats')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(response.body.stats.wins).toBe(5);
    expect(response.body.stats.losses).toBe(3);
  });

  it('should return 404 if profile not found', async () => {
    await request(app)
      .get('/api/users/me/stats')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(404);
  });

  it('should require authentication', async () => {
    await request(app)
      .get('/api/users/me/stats')
      .expect(401);
  });
});
```

**Files to Create**:
- Update `backend/src/api/routes/users.routes.ts`
- Update `backend/src/api/controllers/users.controller.ts`
- Update `backend/src/api/__tests__/users.routes.test.ts`

**Dependencies**: L4-AUTH-001, L4-AUTH-002

**Estimated Time**: 2 hours

---

### L4-HOME-003: StatsCard Component

**Description**: React component displaying user's battle statistics

**User Story**: As a user, I want to see my win/loss record and streak on the homepage so that I can track my progress.

**Acceptance Criteria**:
- [ ] StatsCard component displays wins, losses, win rate, current streak, best streak
- [ ] Shows empty state if no battles played
- [ ] Fetches data using useUserStats hook
- [ ] Shows loading state while fetching
- [ ] Shows error state on fetch failure
- [ ] Link to full stats page (/profile)
- [ ] Win streak shows fire emoji if ≥3
- [ ] All unit tests pass

**Test Cases**:
```typescript
describe('StatsCard', () => {
  it('should display user stats', () => {
    mockUseUserStats({ data: { stats: { wins: 5, losses: 3, totalBattles: 8 } } });

    render(<StatsCard />);

    expect(screen.getByText('5')).toBeInTheDocument(); // wins
    expect(screen.getByText('3')).toBeInTheDocument(); // losses
    expect(screen.getByText('62.5%')).toBeInTheDocument(); // win rate
  });

  it('should show empty state for new users', () => {
    mockUseUserStats({ data: { stats: { totalBattles: 0 } } });

    render(<StatsCard />);

    expect(screen.getByText(/no battles yet/i)).toBeInTheDocument();
  });

  it('should show fire emoji for win streak >= 3', () => {
    mockUseUserStats({ data: { stats: { currentWinStreak: 4 } } });

    render(<StatsCard />);

    expect(screen.getByText(/🔥/)).toBeInTheDocument();
  });
});
```

**Files to Create**:
- `frontend/src/components/HomePage/StatsCard.tsx`
- `frontend/src/components/HomePage/StatsCard.css`
- `frontend/src/components/HomePage/__tests__/StatsCard.test.tsx`
- `frontend/src/hooks/useUserStats.ts`

**Dependencies**: L4-HOME-002 (stats API)

**Estimated Time**: 3 hours

---

Continue with remaining 5 tasks for Phase 2, then Phase 3 and 4...

**IMPORTANT**: Would you like me to continue with the full L4 breakdown (40+ tasks total), or should we start implementing Phase 1 now and break down subsequent phases as we progress?

This is a decision point in your process - I can either:
A) Complete full L4 documentation now (another ~2 hours of spec writing)
B) Start TDD implementation of Phase 1 immediately

Which approach do you prefer?
