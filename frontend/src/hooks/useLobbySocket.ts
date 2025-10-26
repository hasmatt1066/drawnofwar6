/**
 * useLobbySocket Hook
 *
 * React hook for managing lobby socket connection lifecycle.
 * Handles real-time battle list updates via Socket.IO.
 */

import { useState, useEffect, useRef } from 'react';
import { LobbySocket, LobbyBattle } from '../services/lobby-socket';

/**
 * Hook return type
 */
export interface UseLobbySocketResult {
  /** Array of open battles in the lobby */
  battles: LobbyBattle[];
  /** Whether socket is currently connected */
  isConnected: boolean;
  /** Error message if connection failed */
  error: string | null;
}

/**
 * useLobbySocket Hook
 *
 * Manages Socket.IO connection to lobby namespace and maintains
 * real-time battle list state.
 *
 * Features:
 * - Auto-connects on mount
 * - Auto-disconnects on unmount
 * - Subscribes to lobby updates
 * - Maintains synchronized battle list
 * - Tracks connection state
 * - Handles connection errors
 *
 * @returns Object with battles array, connection status, and error
 *
 * @example
 * ```typescript
 * function BattleLobbyPage() {
 *   const { battles, isConnected, error } = useLobbySocket();
 *
 *   if (error) {
 *     return <div>Error: {error}</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
 *       <ul>
 *         {battles.map(battle => (
 *           <li key={battle.battleId}>{battle.battleName}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLobbySocket(): UseLobbySocketResult {
  const [battles, setBattles] = useState<LobbyBattle[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to maintain socket instance across renders
  const socketRef = useRef<LobbySocket | null>(null);

  useEffect(() => {
    try {
      // Create socket instance
      const socket = new LobbySocket();
      socketRef.current = socket;

      // Set up event listeners

      // Full battle list update
      socket.onBattles((newBattles: LobbyBattle[]) => {
        setBattles(newBattles);
        setIsConnected(socket.isConnected());
      });

      // New battle created
      socket.onBattleCreated((battle: LobbyBattle) => {
        setBattles((prevBattles) => {
          // Avoid duplicates
          const exists = prevBattles.some(b => b.battleId === battle.battleId);
          if (exists) {
            return prevBattles;
          }
          return [...prevBattles, battle];
        });
        setIsConnected(socket.isConnected());
      });

      // Battle filled (opponent joined)
      socket.onBattleFilled((data: { battleId: string }) => {
        setBattles((prevBattles) =>
          prevBattles.filter(b => b.battleId !== data.battleId)
        );
        setIsConnected(socket.isConnected());
      });

      // Battle cancelled
      socket.onBattleCancelled((data: { battleId: string }) => {
        setBattles((prevBattles) =>
          prevBattles.filter(b => b.battleId !== data.battleId)
        );
        setIsConnected(socket.isConnected());
      });

      // Connect to lobby
      socket.connect();

      // Cleanup on unmount
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to connect to lobby socket:', err);
    }
  }, []); // Empty deps - only run on mount/unmount

  return {
    battles,
    isConnected,
    error
  };
}
