# L3 Feature: Homepage Hub UI

**Epic**: Matchmaking & Session Management
**Feature ID**: HOME-001
**Status**: Planning
**Created**: 2025-10-25

---

## Overview

Create a persistent homepage hub that serves as the central navigation point after login, displaying battle stats, creature gallery preview, and battle actions.

---

## User Story

**As a** player
**I want to** see my stats, creatures, and battle options in one place
**So that** I can quickly navigate to different parts of the game and understand my progress

---

## Acceptance Criteria

### Must Have (MVP)
- [ ] Homepage displays at `/home` after successful login
- [ ] Persistent navigation bar appears on all pages
- [ ] Four main sections visible without scrolling:
  - Battle stats (wins, losses, win rate, streak)
  - Quick actions (Quick Play, Browse Games, Create Battle, Join by Key)
  - Creature gallery preview (6 most recent creatures)
  - User menu (profile, logout)
- [ ] Empty states for users with no creatures
- [ ] Empty states for users with no battle history
- [ ] Responsive layout (desktop + mobile)
- [ ] Clicking creature card navigates to `/creatures/:id`
- [ ] All navigation links work correctly

### Should Have (Post-MVP)
- [ ] Recent battle history on homepage
- [ ] Achievement badges
- [ ] Friend list
- [ ] Notifications (battle invites, creature generation complete)

### Won't Have (Out of Scope)
- Real-time stats updates during battle
- Creature editing from homepage
- In-app chat

---

## Technical Specification

### Component Structure

```
HomePage/
├── index.tsx                 Main homepage component
├── NavBar.tsx                Persistent navigation
├── StatsCard.tsx             Battle statistics display
├── QuickActions.tsx          Battle action buttons
├── CreaturePreview.tsx       6-creature gallery preview
├── EmptyStates/
│   ├── NoCreatures.tsx
│   └── NoBattles.tsx
└── styles.css
```

### Main Homepage Component

```typescript
// frontend/src/pages/HomePage.tsx
export function HomePage() {
  const { user } = useAuth();
  const { data: profile, loading: profileLoading } = useUserProfile(user.uid);
  const { data: creatures, loading: creaturesLoading } = useUserCreatures(user.uid, 6);

  if (profileLoading) {
    return <LoadingScreen />;
  }

  return (
    <PageLayout>
      <NavBar />

      <HomeContent>
        {/* Top Row: Stats + Quick Actions */}
        <TopRow>
          <StatsCard stats={profile.stats} />
          <QuickActions
            hasMinimumCreatures={creatures.length >= 3}
            onQuickPlay={handleQuickPlay}
            onBrowseGames={() => navigate('/battles')}
            onCreateBattle={handleCreateBattle}
          />
        </TopRow>

        {/* Bottom Row: Creature Preview */}
        <CreatureSection>
          {creatures.length === 0 ? (
            <EmptyState.NoCreatures />
          ) : (
            <CreaturePreview creatures={creatures} />
          )}
        </CreatureSection>
      </HomeContent>
    </PageLayout>
  );
}
```

---

### Persistent Navigation Bar

```typescript
// frontend/src/components/NavBar.tsx
export function NavBar() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Nav>
      <NavLeft>
        <Logo to="/home">
          <img src="/logo.svg" alt="Drawn of War" />
        </Logo>

        <NavLinks>
          <NavLink to="/home" icon={<HomeIcon />}>
            Home
          </NavLink>
          <NavLink to="/gallery" icon={<GridIcon />}>
            Gallery
          </NavLink>
          <NavLink to="/create" icon={<WandIcon />}>
            Create
          </NavLink>
        </NavLinks>
      </NavLeft>

      <NavRight>
        <UserMenu>
          <Avatar
            src={user.photoURL || generateAvatar(user.uid)}
            alt={user.displayName}
            onClick={() => setMenuOpen(!menuOpen)}
          />

          {menuOpen && (
            <Dropdown>
              <DropdownItem to="/profile" icon={<UserIcon />}>
                Profile & Stats
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem onClick={signOut} icon={<LogoutIcon />}>
                Logout
              </DropdownItem>
            </Dropdown>
          )}
        </UserMenu>
      </NavRight>
    </Nav>
  );
}
```

**Responsive Behavior:**
- Desktop: Horizontal nav bar with all links visible
- Tablet: Same as desktop but compact
- Mobile: Hamburger menu with slide-out drawer

---

### Stats Card Component

```typescript
// frontend/src/components/HomePage/StatsCard.tsx
interface StatsCardProps {
  stats: {
    wins: number;
    losses: number;
    totalBattles: number;
    currentWinStreak: number;
    bestWinStreak: number;
  };
}

export function StatsCard({ stats }: StatsCardProps) {
  const winRate = stats.totalBattles > 0
    ? ((stats.wins / stats.totalBattles) * 100).toFixed(1)
    : 0;

  if (stats.totalBattles === 0) {
    return <EmptyState.NoBattles />;
  }

  return (
    <Card>
      <CardHeader>
        <Title>Battle Stats</Title>
        <Icon><TrophyIcon /></Icon>
      </CardHeader>

      <StatsList>
        <StatRow>
          <Label>Wins</Label>
          <Value className="wins">{stats.wins}</Value>
        </StatRow>
        <StatRow>
          <Label>Losses</Label>
          <Value className="losses">{stats.losses}</Value>
        </StatRow>
        <StatRow>
          <Label>Win Rate</Label>
          <Value>{winRate}%</Value>
        </StatRow>
        <StatRow>
          <Label>Win Streak</Label>
          <Value>
            {stats.currentWinStreak > 0 && (
              <>
                {stats.currentWinStreak}
                {stats.currentWinStreak >= 3 && <FireIcon />}
              </>
            )}
            {stats.currentWinStreak === 0 && '—'}
          </Value>
        </StatRow>
        {stats.bestWinStreak > 0 && (
          <StatRow>
            <Label>Best Streak</Label>
            <Value className="muted">{stats.bestWinStreak}</Value>
          </StatRow>
        )}
      </StatsList>

      <CardFooter>
        <Link to="/profile">View Full Stats →</Link>
      </CardFooter>
    </Card>
  );
}
```

---

### Quick Actions Component

```typescript
// frontend/src/components/HomePage/QuickActions.tsx
interface QuickActionsProps {
  hasMinimumCreatures: boolean;
  onQuickPlay: () => void;
  onBrowseGames: () => void;
  onCreateBattle: () => void;
}

export function QuickActions({
  hasMinimumCreatures,
  onQuickPlay,
  onBrowseGames,
  onCreateBattle
}: QuickActionsProps) {
  const [battleKey, setBattleKey] = useState('');
  const navigate = useNavigate();

  const handleJoinByKey = async () => {
    if (!battleKey.trim()) return;

    try {
      const response = await fetch(`/api/battles/${battleKey}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getIdToken()}`
        }
      });

      const data = await response.json();

      if (data.success) {
        navigate(`/deployment?matchId=${data.matchId}&playerId=${data.playerId}`);
      }
    } catch (error) {
      alert('Invalid battle key');
    }
  };

  return (
    <ActionsCard>
      <CardHeader>
        <Title>Quick Actions</Title>
      </CardHeader>

      <ActionsList>
        {/* Quick Play */}
        <ActionButton
          onClick={onQuickPlay}
          disabled={!hasMinimumCreatures}
          variant="primary"
        >
          <Icon>⚡</Icon>
          <ActionText>
            <ActionTitle>Quick Play</ActionTitle>
            <ActionSubtitle>Auto-match with random opponent</ActionSubtitle>
          </ActionText>
        </ActionButton>

        {/* Browse Games */}
        <ActionButton onClick={onBrowseGames}>
          <Icon>🔍</Icon>
          <ActionText>
            <ActionTitle>Browse Games</ActionTitle>
            <ActionSubtitle>Join an open battle</ActionSubtitle>
          </ActionText>
        </ActionButton>

        {/* Create Battle */}
        <ActionButton
          onClick={onCreateBattle}
          disabled={!hasMinimumCreatures}
        >
          <Icon>➕</Icon>
          <ActionText>
            <ActionTitle>Create Battle</ActionTitle>
            <ActionSubtitle>Host a new game</ActionSubtitle>
          </ActionText>
        </ActionButton>
      </ActionsList>

      {/* Join by Key */}
      <JoinByKeySection>
        <Label>Join by Key</Label>
        <InputGroup>
          <Input
            placeholder="e.g., K3P9X2"
            value={battleKey}
            onChange={(e) => setBattleKey(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <Button
            onClick={handleJoinByKey}
            disabled={!hasMinimumCreatures || battleKey.length !== 6}
          >
            Join
          </Button>
        </InputGroup>
      </JoinByKeySection>

      {/* Warning for insufficient creatures */}
      {!hasMinimumCreatures && (
        <Warning>
          <WarningIcon />
          You need at least 3 creatures to battle.
          <Link to="/create">Create more</Link>
        </Warning>
      )}
    </ActionsCard>
  );
}
```

---

### Creature Preview Component

```typescript
// frontend/src/components/HomePage/CreaturePreview.tsx
interface CreaturePreviewProps {
  creatures: Creature[];
}

export function CreaturePreview({ creatures }: CreaturePreviewProps) {
  const navigate = useNavigate();

  return (
    <Section>
      <SectionHeader>
        <Title>Your Creatures ({creatures.length})</Title>
        <Link to="/gallery">View All →</Link>
      </SectionHeader>

      <CreatureGrid>
        {creatures.slice(0, 6).map((creature) => (
          <CreatureCard
            key={creature.id}
            creature={creature}
            onClick={() => navigate(`/creatures/${creature.id}`)}
          />
        ))}
      </CreatureGrid>
    </Section>
  );
}
```

---

### Empty State Components

```typescript
// frontend/src/components/HomePage/EmptyStates/NoCreatures.tsx
export function NoCreatures() {
  return (
    <EmptyState>
      <Icon><WandIcon size={64} /></Icon>
      <Title>Create Your First Creature!</Title>
      <Description>
        Draw, describe, or upload an image to bring your creature to life.
        Your creatures will appear here once created.
      </Description>
      <PrimaryButton to="/create" size="large">
        Create Creature
      </PrimaryButton>
    </EmptyState>
  );
}

// frontend/src/components/HomePage/EmptyStates/NoBattles.tsx
export function NoBattles() {
  return (
    <EmptyState variant="compact">
      <Icon><SwordIcon /></Icon>
      <Title>No battles yet</Title>
      <Description>
        Your stats will appear here after your first battle.
      </Description>
    </EmptyState>
  );
}
```

---

## Layout Specification

### Desktop Layout (1024px+)
```
┌───────────────────────────────────────────────────────────┐
│  [Logo]  Home  Gallery  Create           [@Avatar ▼]     │
├───────────────────────────┬───────────────────────────────┤
│                           │                               │
│   BATTLE STATS            │    QUICK ACTIONS              │
│   ┌─────────────────────┐ │   ┌─────────────────────────┐│
│   │ Wins: 5             │ │   │ ⚡ Quick Play            ││
│   │ Losses: 3           │ │   │ 🔍 Browse Games         ││
│   │ Win Rate: 62.5%     │ │   │ ➕ Create Battle        ││
│   │ Win Streak: 2🔥     │ │   ├─────────────────────────┤│
│   │ Best Streak: 4      │ │   │ Join by Key             ││
│   │                     │ │   │ [______] [Join]         ││
│   │ [View Full Stats →] │ │   └─────────────────────────┘│
│   └─────────────────────┘ │                               │
├───────────────────────────┴───────────────────────────────┤
│                                                           │
│   YOUR CREATURES (12)                  [View All →]      │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│   │ img │ │ img │ │ img │ │ img │ │ img │ │ img │      │
│   │ Name│ │ Name│ │ Name│ │ Name│ │ Name│ │ Name│      │
│   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘      │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Mobile Layout (<768px)
```
┌─────────────────────────┐
│ [☰]  Logo      [@]      │
├─────────────────────────┤
│                         │
│   BATTLE STATS          │
│   Wins: 5  Losses: 3    │
│   Win Rate: 62.5%       │
│   Streak: 2🔥           │
│                         │
├─────────────────────────┤
│                         │
│   QUICK ACTIONS         │
│   [Quick Play]          │
│   [Browse Games]        │
│   [Create Battle]       │
│                         │
│   Join by Key           │
│   [______] [Join]       │
│                         │
├─────────────────────────┤
│                         │
│   YOUR CREATURES (12)   │
│   ┌─────┐ ┌─────┐      │
│   │ img │ │ img │      │
│   └─────┘ └─────┘      │
│   ┌─────┐ ┌─────┐      │
│   │ img │ │ img │      │
│   └─────┘ └─────┘      │
│   [View All →]          │
│                         │
└─────────────────────────┘
```

---

## Styling Guide

### Color Palette
```css
--primary: #6366f1;       /* Indigo for primary actions */
--success: #10b981;       /* Green for wins */
--danger: #ef4444;        /* Red for losses */
--warning: #f59e0b;       /* Orange for warnings */
--muted: #6b7280;         /* Gray for secondary text */
--background: #f9fafb;    /* Light gray background */
--card: #ffffff;          /* White cards */
```

### Typography
```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-size-base: 16px;
--font-size-lg: 18px;
--font-size-xl: 24px;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-bold: 700;
```

---

## API Integration

### Endpoints Used
```typescript
GET /api/users/me/profile          // Profile + stats
GET /api/creature-library/list     // User's creatures (limit 6)
  ?ownerId={userId}&limit=6&offset=0

POST /api/battles                  // Quick Play / Create Battle
POST /api/battles/:key/join        // Join by key
```

---

## Routing Configuration

```typescript
// frontend/src/App.tsx
<BrowserRouter>
  <Routes>
    {/* Public routes */}
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />

    {/* Protected routes */}
    <Route path="/" element={<Navigate to="/home" replace />} />
    <Route path="/home" element={
      <ProtectedRoute>
        <HomePage />
      </ProtectedRoute>
    } />
    <Route path="/gallery" element={
      <ProtectedRoute>
        <GalleryPage />
      </ProtectedRoute>
    } />
    <Route path="/creatures/:id" element={
      <ProtectedRoute>
        <CreatureDetailPage />
      </ProtectedRoute>
    } />
    <Route path="/create" element={
      <ProtectedRoute>
        <CreatePage />
      </ProtectedRoute>
    } />
    <Route path="/generation/:jobId" element={
      <ProtectedRoute>
        <GenerationPage />
      </ProtectedRoute>
    } />
    <Route path="/deployment" element={
      <ProtectedRoute>
        <DeploymentPage />
      </ProtectedRoute>
    } />
    <Route path="/profile" element={
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    } />
  </Routes>
</BrowserRouter>
```

---

## Custom Hooks

```typescript
// frontend/src/hooks/useUserProfile.ts
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const response = await fetch('/api/users/me/profile', {
        headers: {
          'Authorization': `Bearer ${await getIdToken()}`
        }
      });
      return response.json();
    },
    staleTime: 60000 // Cache for 1 minute
  });
}

// frontend/src/hooks/useUserCreatures.ts
export function useUserCreatures(userId: string, limit: number = 6) {
  return useQuery({
    queryKey: ['creatures', userId, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/creature-library/list?ownerId=${userId}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${await getIdToken()}`
          }
        }
      );
      return response.json();
    }
  });
}
```

---

## Testing Strategy

### Unit Tests
- [ ] StatsCard renders correctly with data
- [ ] StatsCard shows empty state with no battles
- [ ] QuickActions disables buttons when insufficient creatures
- [ ] CreaturePreview shows max 6 creatures
- [ ] NavBar renders all links correctly

### Integration Tests
- [ ] Homepage loads user profile and creatures
- [ ] Clicking creature navigates to detail page
- [ ] Quick Play creates/joins battle
- [ ] Join by key validates input format

### E2E Tests
- [ ] User logs in and lands on homepage
- [ ] User with no creatures sees empty state
- [ ] User with creatures can navigate to gallery
- [ ] User can create battle from homepage

---

## Success Metrics

- Homepage load time: <1 second
- Time to first action (click): <5 seconds
- Navigation success rate: >99%
- Mobile usability score: >90

---

## Related Documents

- Planning: `docs/active/L3-FEATURES/homepage-hub-battle-lobby-planning.md`
- Auth: `docs/specs/L3-FEATURES/homepage-hub/firebase-auth-integration.md`
- Battle Lobby: `docs/specs/L3-FEATURES/homepage-hub/battle-lobby-system.md`
