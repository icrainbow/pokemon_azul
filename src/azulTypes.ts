import type { PokemonType, PokemonTile } from './types';

// Azul-specific types for full game implementation

export type TileColor = PokemonType; // Using PokemonType as tile colors

export interface Tile {
  id: string;
  color: TileColor;
}

export interface Factory {
  id: number;
  tiles: Tile[];
}

export interface Center {
  tiles: Tile[];
  hasStartingPlayerMarker: boolean;
}

export interface PatternLine {
  capacity: number; // 1, 2, 3, 4, 5
  tiles: Tile[];
  color: TileColor | null; // null if empty
}

export interface WallTile {
  color: TileColor;
  penaltyCount: number;
  injured: boolean;
}

export interface Wall {
  // 5x5 grid, each position either has a tile or is empty
  // grid[row][col] = WallTile | null
  grid: (WallTile | null)[][];
}

export interface FloorLine {
  tiles: Tile[];
  hasStartingPlayerMarker: boolean;
}

export interface PlayerBoard {
  playerId: number;
  score: number;
  patternLines: PatternLine[]; // 5 lines
  wall: Wall;
  floorLine: FloorLine;
  isStartingPlayer: boolean;
}

export type GamePhase = 'factory-offer' | 'wall-tiling' | 'game-end';

export interface AzulState {
  players: PlayerBoard[];
  factories: Factory[];
  center: Center;
  bag: Tile[];
  lid: Tile[]; // discard pile
  currentPlayerIndex: number;
  phase: GamePhase;
  round: number;
  gameEnded: boolean;
  takenTiles?: Tile[]; // Temporary storage for tiles taken but not yet placed
  autoFlooredTiles?: boolean; // Flag indicating tiles were automatically sent to floor
}

// Floor line penalties (standard Azul)
export const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3];

// Check if a wall row already contains a tile of the specified color
export function rowHasColor(wall: Wall, row: number, color: TileColor): boolean {
  for (let col = 0; col < 5; col++) {
    const tile = wall.grid[row][col];
    if (tile && tile.color === color) {
      return true;
    }
  }
  return false;
}

// Check if a tile can be placed at a specific wall position
// Rules:
// 1. Position must be empty
// 2. No adjacent tiles (up/down/left/right) have the same color
// 3. Row must not already contain a tile of the same color
export function canPlaceOnWall(wall: Wall, row: number, col: number, color: TileColor): boolean {
  // Check if position is empty
  if (wall.grid[row][col] !== null) {
    return false;
  }

  // Check if row already has this color (NEW RULE)
  if (rowHasColor(wall, row, color)) {
    return false;
  }

  // Check adjacent positions (up, down, left, right)
  const adjacentPositions = [
    [row - 1, col], // up
    [row + 1, col], // down
    [row, col - 1], // left
    [row, col + 1], // right
  ];

  for (const [adjRow, adjCol] of adjacentPositions) {
    // Check bounds
    if (adjRow >= 0 && adjRow < 5 && adjCol >= 0 && adjCol < 5) {
      const adjacentTile = wall.grid[adjRow][adjCol];
      if (adjacentTile && adjacentTile.color === color) {
        return false; // Same color adjacent - not allowed
      }
    }
  }

  return true;
}

// Check if a player has 5 consecutive tiles in a row or column (game end condition)
export function hasConsecutiveFive(wall: Wall): boolean {
  // Check rows
  for (let row = 0; row < 5; row++) {
    let consecutive = 0;
    for (let col = 0; col < 5; col++) {
      if (wall.grid[row][col] !== null) {
        consecutive++;
        if (consecutive >= 5) return true;
      } else {
        consecutive = 0;
      }
    }
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    let consecutive = 0;
    for (let row = 0; row < 5; row++) {
      if (wall.grid[row][col] !== null) {
        consecutive++;
        if (consecutive >= 5) return true;
      } else {
        consecutive = 0;
      }
    }
  }

  return false;
}

// Calculate final bonus scoring for completed lines
export function calculateFinalBonus(wall: Wall): number {
  let bonus = 0;

  // Horizontal lines (rows)
  for (let row = 0; row < 5; row++) {
    let consecutiveCount = 0;
    for (let col = 0; col < 5; col++) {
      if (wall.grid[row][col] !== null) {
        consecutiveCount++;
      } else {
        if (consecutiveCount >= 2) {
          bonus += consecutiveCount;
        }
        consecutiveCount = 0;
      }
    }
    // Check at end of row
    if (consecutiveCount >= 2) {
      bonus += consecutiveCount;
    }
  }

  // Vertical lines (columns)
  for (let col = 0; col < 5; col++) {
    let consecutiveCount = 0;
    for (let row = 0; row < 5; row++) {
      if (wall.grid[row][col] !== null) {
        consecutiveCount++;
      } else {
        if (consecutiveCount >= 2) {
          bonus += consecutiveCount;
        }
        consecutiveCount = 0;
      }
    }
    // Check at end of column
    if (consecutiveCount >= 2) {
      bonus += consecutiveCount;
    }
  }

  return bonus;
}

// Check if a player has any filled (completed) pattern lines
export function hasAnyFilledPatternLine(patternLines: PatternLine[]): boolean {
  return patternLines.some(line => line.tiles.length === line.capacity && line.capacity > 0);
}

// Check if the round has ended (all factories AND center are empty)
export function isRoundEnded(state: Pick<AzulState, 'factories' | 'center'>): boolean {
  const allFactoriesEmpty = state.factories.every(f => f.tiles.length === 0);
  const centerEmpty = state.center.tiles.length === 0;
  return allFactoriesEmpty && centerEmpty;
}

// Check if a specific pattern line can accept tiles of a given color
// Considers: line color compatibility, line not full, and row uniqueness rule
export function canPlaceToPatternLine(
  player: PlayerBoard,
  patternLineIndex: number,
  color: TileColor
): boolean {
  const line = player.patternLines[patternLineIndex];

  // Check if line has different color already
  if (line.color !== null && line.color !== color) {
    return false;
  }

  // Check if line is full
  if (line.tiles.length >= line.capacity) {
    return false;
  }

  // Check if the wall row corresponding to this pattern line already has this color
  // Pattern line index maps to wall row (line 0 -> row 0, etc.)
  if (rowHasColor(player.wall, patternLineIndex, color)) {
    return false;
  }

  return true;
}

// Check if ANY pattern line can accept tiles of a given color
export function hasValidPatternLineForColor(player: PlayerBoard, color: TileColor): boolean {
  for (let i = 0; i < player.patternLines.length; i++) {
    if (canPlaceToPatternLine(player, i, color)) {
      return true;
    }
  }
  return false;
}
