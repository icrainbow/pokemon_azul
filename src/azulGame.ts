import type {
  AzulState,
  PlayerBoard,
  Factory,
  Center,
  Tile,
  TileColor,
  Wall,
  PatternLine,
  FloorLine,
} from './azulTypes';
import {
  FLOOR_PENALTIES,
  canPlaceOnWall,
  hasConsecutiveFive,
  calculateFinalBonus,
  hasAnyFilledPatternLine,
  isRoundEnded,
  hasValidPatternLineForColor,
  canPlaceToPatternLine,
} from './azulTypes';
import { restricts } from './typeEffectiveness';
import type { PokemonType } from './types';

// Initialize a new game
export function initGame(numPlayers: number, config?: { rng?: () => number }): AzulState {
  if (numPlayers < 2 || numPlayers > 4) {
    throw new Error('Game requires 2-4 players');
  }

  const factoryCount = numPlayers === 2 ? 5 : numPlayers === 3 ? 7 : 9;

  // Create tile bag (20 of each color)
  const colors: TileColor[] = ['fire', 'water', 'grass', 'electric', 'psychic'];
  const bag: Tile[] = [];
  let tileId = 0;
  for (const color of colors) {
    for (let i = 0; i < 20; i++) {
      bag.push({ id: `tile-${tileId++}`, color });
    }
  }

  // Shuffle bag
  shuffleArray(bag);

  // Create players
  const players: PlayerBoard[] = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push(createPlayerBoard(i));
  }
  players[0].isStartingPlayer = true;

  // Create factories
  const factories: Factory[] = [];
  for (let i = 0; i < factoryCount; i++) {
    factories.push({ id: i, tiles: [] });
  }

  // Create center
  const center: Center = {
    tiles: [],
    hasStartingPlayerMarker: true,
  };

  const state: AzulState = {
    players,
    factories,
    center,
    bag,
    lid: [],
    currentPlayerIndex: 0,
    phase: 'factory-offer',
    round: 1,
    gameEnded: false,
    config: config || { rng: Math.random },
  };

  // Fill factories for first round
  return refillFactories(state);
}

function createPlayerBoard(playerId: number): PlayerBoard {
  const patternLines: PatternLine[] = [];
  for (let i = 0; i < 5; i++) {
    patternLines.push({
      capacity: i + 1,
      tiles: [],
      color: null,
    });
  }

  const wall: Wall = {
    grid: Array(5)
      .fill(null)
      .map(() => Array(5).fill(null)),
  };

  return {
    playerId,
    score: 0,
    patternLines,
    lastTripleAttackRound: null,
    wall,
    floorLine: { tiles: [], hasStartingPlayerMarker: false },
    isStartingPlayer: false,
  };
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Take tiles from factory or center
export function takeTiles(
  state: AzulState,
  source: 'factory' | 'center',
  sourceId: number | null, // factory id, or null for center
  color: TileColor
): AzulState {
  if (state.phase !== 'factory-offer') {
    throw new Error('Can only take tiles during factory-offer phase');
  }

  // Deep copy state to prevent mutation
  const newState = { ...state };
  newState.factories = newState.factories.map(f => ({ ...f, tiles: [...f.tiles] }));
  const takenTiles: Tile[] = [];

  if (source === 'factory') {
    if (sourceId === null) throw new Error('Factory ID required');
    const factory = newState.factories.find((f) => f.id === sourceId);
    if (!factory) throw new Error('Factory not found');

    // Take all tiles of the specified color
    takenTiles.push(...factory.tiles.filter((t) => t.color === color));

    // Move remaining tiles to center
    const remainingTiles = factory.tiles.filter((t) => t.color !== color);
    newState.center = {
      ...newState.center,
      tiles: [...newState.center.tiles, ...remainingTiles],
    };

    // Empty the factory
    factory.tiles = [];
  } else {
    // Take from center
    takenTiles.push(...newState.center.tiles.filter((t) => t.color === color));

    // Remove taken tiles from center
    newState.center = {
      ...newState.center,
      tiles: newState.center.tiles.filter((t) => t.color !== color),
    };

    // If taking from center for the first time this round, take starting player marker
    if (newState.center.hasStartingPlayerMarker) {
      // Deep copy players array and current player
      newState.players = state.players.map((p, idx) => {
        if (idx === newState.currentPlayerIndex) {
          return {
            ...p,
            floorLine: { ...p.floorLine, tiles: [...p.floorLine.tiles], hasStartingPlayerMarker: true },
            isStartingPlayer: true
          };
        }
        return { ...p, isStartingPlayer: false };
      });
      newState.center.hasStartingPlayerMarker = false;
    }
  }

  // Check if current player has any valid pattern lines for this color
  const currentPlayer = newState.players[newState.currentPlayerIndex];
  const hasValidLines = hasValidPatternLineForColor(currentPlayer, color);

  if (!hasValidLines) {
    // No valid pattern lines - send all taken tiles directly to floor
    // Deep copy players array if not already done
    if (!newState.players || newState.players === state.players) {
      newState.players = [...state.players];
    }

    // Deep copy current player
    const oldPlayer = state.players[newState.currentPlayerIndex];
    newState.players[newState.currentPlayerIndex] = {
      ...oldPlayer,
      wall: {
        ...oldPlayer.wall,
        grid: oldPlayer.wall.grid.map(row => [...row])
      },
      patternLines: oldPlayer.patternLines.map(line => ({
        ...line,
        tiles: [...line.tiles]
      })),
      floorLine: {
        ...oldPlayer.floorLine,
        tiles: [...oldPlayer.floorLine.tiles, ...takenTiles]
      }
    };

    // Move to next player
    const nextPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;

    // Check if round ended after this action
    if (isRoundEnded(newState)) {
      // Check if any player has filled pattern lines
      const playersWithFilledLines = newState.players.filter(p =>
        hasAnyFilledPatternLine(p.patternLines)
      );

      if (playersWithFilledLines.length === 0) {
        // No player has filled lines - skip wall-tiling phase and start new round
        return finishWallTiling({ ...newState, phase: 'wall-tiling' });
      }

      // Find first player with filled lines
      let firstPlayerWithFilledLines = newState.currentPlayerIndex;
      for (let i = 0; i < newState.players.length; i++) {
        const checkIndex = (newState.currentPlayerIndex + i) % newState.players.length;
        if (hasAnyFilledPatternLine(newState.players[checkIndex].patternLines)) {
          firstPlayerWithFilledLines = checkIndex;
          break;
        }
      }

      // Transition to wall-tiling phase
      return {
        ...newState,
        phase: 'wall-tiling',
        currentPlayerIndex: firstPlayerWithFilledLines,
        autoFlooredTiles: true as any // Flag to indicate tiles went to floor
      };
    }

    // Round not ended - just move to next player
    return {
      ...newState,
      currentPlayerIndex: nextPlayerIndex,
      autoFlooredTiles: true as any // Flag to indicate tiles went to floor
    };
  }

  return {
    ...newState,
    // Return state with taken tiles (to be placed by placeToPatternLine)
    takenTiles: takenTiles as any, // temporary storage
  };
}

// Place tiles to a pattern line
export function placeToPatternLine(
  state: AzulState & { takenTiles?: Tile[] },
  patternLineIndex: number
): AzulState {
  const takenTiles = state.takenTiles || [];
  if (takenTiles.length === 0) {
    throw new Error('No tiles to place');
  }

  // Deep copy state to prevent mutation
  const newState = { ...state };
  newState.players = [...state.players];

  // Deep copy the current player
  const currentPlayerIdx = newState.currentPlayerIndex;
  const oldPlayer = state.players[currentPlayerIdx];
  newState.players[currentPlayerIdx] = {
    ...oldPlayer,
    wall: {
      ...oldPlayer.wall,
      grid: oldPlayer.wall.grid.map(row => [...row])
    },
    patternLines: oldPlayer.patternLines.map(line => ({
      ...line,
      tiles: [...line.tiles]
    })),
    floorLine: {
      ...oldPlayer.floorLine,
      tiles: [...oldPlayer.floorLine.tiles]
    }
  };

  const player = newState.players[currentPlayerIdx];
  const line = player.patternLines[patternLineIndex];
  const color = takenTiles[0].color;

  // Check if line already has tiles of a different color
  if (line.color !== null && line.color !== color) {
    throw new Error('Pattern line already has tiles of a different color');
  }

  // Check if the wall row already has this color (NEW VALIDATION)
  if (!canPlaceToPatternLine(oldPlayer, patternLineIndex, color)) {
    throw new Error('Cannot place tiles: wall row already has this color');
  }

  // Set line color
  line.color = color;

  // Add tiles to line, overflow goes to floor
  const spaceLeft = line.capacity - line.tiles.length;
  const tilesToAdd = takenTiles.slice(0, spaceLeft);
  const overflow = takenTiles.slice(spaceLeft);

  line.tiles.push(...tilesToAdd);
  player.floorLine.tiles.push(...overflow);

  // Delete temporary storage
  delete (newState as any).takenTiles;

  // Check if factory phase should end
  return checkAndTransitionPhase(newState);
}

function checkAndTransitionPhase(state: AzulState): AzulState {
  // Check if round has ended (all factories AND center are empty)
  if (isRoundEnded(state)) {
    // Check if any player has filled pattern lines
    const playersWithFilledLines = state.players.filter(p =>
      hasAnyFilledPatternLine(p.patternLines)
    );

    if (playersWithFilledLines.length === 0) {
      // No player has filled lines - skip wall-tiling phase and start new round
      return finishWallTiling({ ...state, phase: 'wall-tiling' });
    }

    // Find first player with filled lines (starting from current player)
    let firstPlayerWithFilledLines = state.currentPlayerIndex;
    for (let i = 0; i < state.players.length; i++) {
      const checkIndex = (state.currentPlayerIndex + i) % state.players.length;
      if (hasAnyFilledPatternLine(state.players[checkIndex].patternLines)) {
        firstPlayerWithFilledLines = checkIndex;
        break;
      }
    }

    // Transition to wall-tiling phase with correct player
    return {
      ...state,
      phase: 'wall-tiling',
      currentPlayerIndex: firstPlayerWithFilledLines
    };
  }

  // Round not ended - move to next player
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return { ...state, currentPlayerIndex: nextPlayerIndex };
}

// NOTE: wallTilingPhase (automatic) removed - now using manual placePatternLineToWall + finishWallTiling

function checkWallTypeRestriction(
  wall: Wall,
  row: number,
  col: number,
  placedColor: PokemonType
): boolean {
  const adjacentPositions = [
    [row - 1, col], // up
    [row + 1, col], // down
    [row, col - 1], // left
    [row, col + 1], // right
  ];

  for (const [r, c] of adjacentPositions) {
    if (r >= 0 && r < 5 && c >= 0 && c < 5) {
      const adjacentTile = wall.grid[r][c];
      if (adjacentTile && restricts(adjacentTile.color as PokemonType, placedColor)) {
        return true;
      }
    }
  }

  return false;
}

function calculateWallScore(wall: Wall, row: number, col: number): number {
  // Count horizontal connected tiles
  let horizontalCount = 1;
  // Check left
  for (let c = col - 1; c >= 0; c--) {
    if (wall.grid[row][c]) horizontalCount++;
    else break;
  }
  // Check right
  for (let c = col + 1; c < 5; c++) {
    if (wall.grid[row][c]) horizontalCount++;
    else break;
  }

  // Count vertical connected tiles
  let verticalCount = 1;
  // Check up
  for (let r = row - 1; r >= 0; r--) {
    if (wall.grid[r][col]) verticalCount++;
    else break;
  }
  // Check down
  for (let r = row + 1; r < 5; r++) {
    if (wall.grid[r][col]) verticalCount++;
    else break;
  }

  // Score calculation (Azul rules)
  if (horizontalCount > 1 && verticalCount > 1) {
    return horizontalCount + verticalCount;
  } else if (horizontalCount > 1) {
    return horizontalCount;
  } else if (verticalCount > 1) {
    return verticalCount;
  } else {
    return 1; // Isolated tile
  }
}

function refillFactories(state: AzulState): AzulState {
  const newState = { ...state };

  for (const factory of newState.factories) {
    // Draw 4 tiles from bag
    for (let i = 0; i < 4; i++) {
      if (newState.bag.length === 0) {
        // Refill bag from lid
        newState.bag = [...newState.lid];
        newState.lid = [];
        shuffleArray(newState.bag);
      }

      if (newState.bag.length > 0) {
        factory.tiles.push(newState.bag.pop()!);
      }
    }
  }

  return newState;
}

// Place a single tile from a completed pattern line to the wall (manual wall-tiling)
export function placePatternLineToWall(
  state: AzulState,
  playerIndex: number,
  lineIndex: number,
  wallRow: number,
  wallCol: number
): AzulState {
  if (state.phase !== 'wall-tiling') {
    throw new Error('Not in wall-tiling phase');
  }

  // Validate that pattern line index matches wall row
  if (lineIndex !== wallRow) {
    throw new Error(`Pattern line ${lineIndex} can only be placed on wall row ${lineIndex}, not row ${wallRow}`);
  }

  // Deep copy state to prevent mutation
  let newState = { ...state };
  newState.players = [...state.players];

  // Deep copy the specific player being modified
  const oldPlayer = state.players[playerIndex];
  newState.players[playerIndex] = {
    ...oldPlayer,
    wall: {
      ...oldPlayer.wall,
      grid: oldPlayer.wall.grid.map(row => [...row])
    },
    patternLines: oldPlayer.patternLines.map(line => ({
      ...line,
      tiles: [...line.tiles]
    })),
    floorLine: {
      ...oldPlayer.floorLine,
      tiles: [...oldPlayer.floorLine.tiles]
    }
  };

  const player = newState.players[playerIndex];
  const line = player.patternLines[lineIndex];

  // Check if line is complete
  if (line.tiles.length !== line.capacity) {
    throw new Error('Pattern line is not complete');
  }

  // Check if wall position is valid (empty + no same-color adjacent)
  if (!canPlaceOnWall(player.wall, wallRow, wallCol, line.color!)) {
    throw new Error('Cannot place tile at this position: position occupied or same color adjacent');
  }

  // Take the rightmost tile to place
  const tileToPlace = line.tiles[line.tiles.length - 1];

  // Create wall tile
  const wallTile = {
    color: tileToPlace.color,
    penaltyCount: 0,
    injured: false,
    koStatus: false,
    placementTimestamp: Date.now(),
  };

  // Check for type restriction (adjacent tiles)
  const hasRestriction = checkWallTypeRestriction(
    player.wall,
    wallRow,
    wallCol,
    tileToPlace.color as PokemonType
  );

  // Calculate score
  let baseScore = calculateWallScore(player.wall, wallRow, wallCol);

  if (hasRestriction) {
    baseScore = Math.max(0, baseScore - 1);
    wallTile.penaltyCount = 1;
    wallTile.injured = true;
  }

  // Check kill rule
  if (wallTile.penaltyCount >= 2) {
    // Tile is killed, don't place it
    baseScore = 0;
  } else {
    // Place tile on wall
    player.wall.grid[wallRow][wallCol] = wallTile;
    player.score += baseScore;
  }

  // Check and execute triple attack (after tile is placed)
  newState = checkAndExecuteTripleAttack(newState, playerIndex);

  // Move remaining tiles back to center (not to lid)
  newState.center.tiles.push(...line.tiles.slice(0, -1));

  // Clear pattern line
  line.tiles = [];
  line.color = null;

  // Check if current player still has full lines to process
  const currentPlayerFullLines = player.patternLines.filter(
    (l) => l.tiles.length === l.capacity
  );

  // If no more full lines, move to next player with full lines
  if (currentPlayerFullLines.length === 0) {
    // Find next player with full lines
    let nextPlayerIndex = (playerIndex + 1) % newState.players.length;
    let checkedPlayers = 0;

    while (checkedPlayers < newState.players.length) {
      const nextPlayer = newState.players[nextPlayerIndex];
      const hasFullLines = nextPlayer.patternLines.some(
        (l) => l.tiles.length === l.capacity
      );

      if (hasFullLines) {
        newState.currentPlayerIndex = nextPlayerIndex;
        break;
      }

      nextPlayerIndex = (nextPlayerIndex + 1) % newState.players.length;
      checkedPlayers++;
    }

    // If no player has full lines, stay on current player (finishWallTiling will handle phase transition)
    if (checkedPlayers === newState.players.length) {
      newState.currentPlayerIndex = playerIndex;
    }
  }

  return newState;
}

// Finish wall-tiling phase (after all completed lines are processed)
export function finishWallTiling(state: AzulState): AzulState {
  if (state.phase !== 'wall-tiling') {
    throw new Error('Not in wall-tiling phase');
  }

  let newState = { ...state };

  // Apply floor penalties for all players
  for (const player of newState.players) {
    const floorCount = player.floorLine.tiles.length +
      (player.floorLine.hasStartingPlayerMarker ? 1 : 0);
    let penalty = 0;
    for (let i = 0; i < Math.min(floorCount, FLOOR_PENALTIES.length); i++) {
      penalty += FLOOR_PENALTIES[i];
    }
    player.score = Math.max(0, player.score + penalty);

    // Move floor tiles to lid
    newState.lid.push(...player.floorLine.tiles);
    player.floorLine.tiles = [];
    player.floorLine.hasStartingPlayerMarker = false;
  }

  // Check for game end (any player has 5 consecutive tiles in a row or column)
  const gameEnded = newState.players.some((p) => hasConsecutiveFive(p.wall));

  if (gameEnded) {
    // Apply final bonus scoring
    for (const player of newState.players) {
      const bonus = calculateFinalBonus(player.wall);
      player.score += bonus;
    }
    return { ...newState, phase: 'game-end', gameEnded: true };
  }

  // Clear center tiles (move to lid) - round is over, any remaining tiles go to discard
  newState.lid.push(...newState.center.tiles);
  newState.center.tiles = [];

  // Prepare next round - always refill factories
  newState = refillFactories(newState);
  newState.phase = 'factory-offer';
  newState.round += 1;

  // Set current player to starting player
  const startingPlayerIndex = newState.players.findIndex((p) => p.isStartingPlayer);
  newState.currentPlayerIndex = startingPlayerIndex;

  // Reset center with starting player marker
  newState.center = {
    tiles: [],
    hasStartingPlayerMarker: true,
  };

  return newState;
}

// Heal an injured tile
export function healTile(state: AzulState, playerIndex: number, row: number, col: number): AzulState {
  // Deep copy state to prevent mutation
  const newState = { ...state };
  newState.players = [...state.players];

  // Deep copy the specific player being modified
  const oldPlayer = state.players[playerIndex];
  newState.players[playerIndex] = {
    ...oldPlayer,
    wall: {
      ...oldPlayer.wall,
      grid: oldPlayer.wall.grid.map(row => [...row])
    },
    patternLines: oldPlayer.patternLines.map(line => ({
      ...line,
      tiles: [...line.tiles]
    })),
    floorLine: {
      ...oldPlayer.floorLine,
      tiles: [...oldPlayer.floorLine.tiles]
    }
  };

  const player = newState.players[playerIndex];
  const tile = player.wall.grid[row][col];

  if (!tile) {
    throw new Error('No tile at this position');
  }

  if (!tile.injured) {
    throw new Error('Tile is not injured');
  }

  tile.injured = false;

  return newState;
}

// ============================================================================
// TRIPLE ATTACK FEATURE (Wall Triple Attack)
// ============================================================================

/**
 * Creates a seeded RNG function for deterministic random behavior in tests.
 * Uses a simple Linear Congruential Generator (LCG) algorithm.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Triple detection: A "triple" exists when a player's wall contains >= 3
 * NON-KO tiles of the SAME type (Pokemon type).
 *
 * Returns an array of tile positions grouped by type for all types with >= 3 alive tiles.
 */
interface TripleCandidate {
  type: TileColor;
  tiles: Array<{ row: number; col: number; timestamp: number }>;
}

export function detectTriples(wall: Wall): TripleCandidate[] {
  const typeGroups = new Map<TileColor, Array<{ row: number; col: number; timestamp: number }>>();

  // Scan all wall positions
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const tile = wall.grid[row][col];
      if (tile && !tile.koStatus) {
        // Only count alive (non-KO) tiles
        if (!typeGroups.has(tile.color)) {
          typeGroups.set(tile.color, []);
        }
        typeGroups.get(tile.color)!.push({
          row,
          col,
          timestamp: tile.placementTimestamp || 0,
        });
      }
    }
  }

  // Filter groups with >= 3 tiles and sort by timestamp
  const candidates: TripleCandidate[] = [];
  for (const [type, tiles] of typeGroups.entries()) {
    if (tiles.length >= 3) {
      // Sort by timestamp (earliest first) for deterministic selection
      tiles.sort((a, b) => a.timestamp - b.timestamp);
      candidates.push({ type, tiles });
    }
  }

  return candidates;
}

/**
 * Selects ONE triple from multiple candidates.
 * Priority: Type order (Fire > Water > Grass > Electric > Psychic) → earliest timestamp.
 * Returns the first 3 tiles from the selected candidate.
 */
export function selectTripleToActivate(candidates: TripleCandidate[]): TripleCandidate | null {
  if (candidates.length === 0) return null;

  // Type priority order
  const typePriority: TileColor[] = ['fire', 'water', 'grass', 'electric', 'psychic'];

  // Sort candidates by type priority
  candidates.sort((a, b) => {
    const aPriority = typePriority.indexOf(a.type);
    const bPriority = typePriority.indexOf(b.type);
    return aPriority - bPriority;
  });

  // Return first candidate with only first 3 tiles
  const selected = candidates[0];
  return {
    type: selected.type,
    tiles: selected.tiles.slice(0, 3),
  };
}

/**
 * Selects a random alive (non-KO) tile from opponent's wall.
 * Returns null if no valid targets exist (all tiles are KO'd).
 */
export function chooseAttackTarget(
  opponentWall: Wall,
  rng: () => number
): { row: number; col: number } | null {
  const aliveTiles: Array<{ row: number; col: number }> = [];

  // Collect all alive tiles
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const tile = opponentWall.grid[row][col];
      if (tile && !tile.koStatus) {
        aliveTiles.push({ row, col });
      }
    }
  }

  if (aliveTiles.length === 0) return null;

  // Select random tile using provided RNG
  const index = Math.floor(rng() * aliveTiles.length);
  return aliveTiles[index];
}

/**
 * Applies attack to target tile: injured → KO, healthy → injured.
 * Returns the outcome ('injured' or 'ko').
 */
export function applyAttack(
  opponentWall: Wall,
  targetRow: number,
  targetCol: number
): 'injured' | 'ko' {
  const targetTile = opponentWall.grid[targetRow][targetCol];
  if (!targetTile) {
    throw new Error('No tile at target position');
  }

  if (targetTile.injured) {
    // Already injured → becomes KO
    targetTile.koStatus = true;
    return 'ko';
  } else {
    // Healthy → becomes injured
    targetTile.injured = true;
    targetTile.penaltyCount = Math.max(targetTile.penaltyCount, 1);
    return 'injured';
  }
}

/**
 * Checks and executes triple attack after a tile is placed on the wall.
 * Returns updated state with attack applied (if triggered).
 *
 * Anti-loop rule: Maximum ONE triple attack per player per round.
 */
export function checkAndExecuteTripleAttack(
  state: AzulState,
  attackerIndex: number
): AzulState {
  const attacker = state.players[attackerIndex];

  // Anti-loop check: only one attack per player per round
  if (attacker.lastTripleAttackRound === state.round) {
    return state; // Already attacked this round
  }

  // Detect triples
  const candidates = detectTriples(attacker.wall);
  if (candidates.length === 0) {
    return state; // No triple formed
  }

  // Select triple to activate
  const triple = selectTripleToActivate(candidates);
  if (!triple) {
    return state; // No valid triple
  }

  // Choose opponent (for 2-player game, it's the other player)
  const opponentIndex = (attackerIndex + 1) % state.players.length;
  const opponent = state.players[opponentIndex];

  // Choose target tile
  const rng = state.config?.rng || Math.random;
  const target = chooseAttackTarget(opponent.wall, rng);

  if (!target) {
    // No valid target (all opponent tiles are KO'd)
    // Attack fizzles, but still mark as attacked this round
    const newState = { ...state };
    newState.players = [...state.players];
    newState.players[attackerIndex] = {
      ...attacker,
      lastTripleAttackRound: state.round,
    };
    return newState;
  }

  // Apply attack
  const newState = { ...state };
  newState.players = [...state.players];

  // Deep copy attacker
  newState.players[attackerIndex] = {
    ...attacker,
    lastTripleAttackRound: state.round,
  };

  // Deep copy opponent with wall update
  const newOpponent = {
    ...opponent,
    wall: {
      ...opponent.wall,
      grid: opponent.wall.grid.map(row => [...row]),
    },
  };

  applyAttack(newOpponent.wall, target.row, target.col);
  newState.players[opponentIndex] = newOpponent;

  return newState;
}
