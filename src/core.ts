import { PokemonTile, Position, Wall, PlacementResult } from './types';
import { restricts } from './typeEffectiveness';

// Create empty wall
export function createWall(rows: number, cols: number): Wall {
  return {
    tiles: new Map(),
    grid: new Map(),
    size: { rows, cols },
  };
}

// Helper to convert position to string key
function positionKey(pos: Position): string {
  return `${pos.row},${pos.col}`;
}

// Get adjacent positions (up, down, left, right)
function getAdjacentPositions(pos: Position, wall: Wall): Position[] {
  const positions: Position[] = [
    { row: pos.row - 1, col: pos.col },
    { row: pos.row + 1, col: pos.col },
    { row: pos.row, col: pos.col - 1 },
    { row: pos.row, col: pos.col + 1 },
  ];

  return positions.filter(
    (p) =>
      p.row >= 0 &&
      p.row < wall.size.rows &&
      p.col >= 0 &&
      p.col < wall.size.cols
  );
}

// Calculate base adjacency score (standard Azul rules)
function calculateAdjacencyScore(pos: Position, wall: Wall): number {
  let score = 0;

  // Check horizontal line
  let horizontalCount = 1; // The tile itself
  // Check left
  for (let c = pos.col - 1; c >= 0; c--) {
    if (wall.grid.has(positionKey({ row: pos.row, col: c }))) {
      horizontalCount++;
    } else {
      break;
    }
  }
  // Check right
  for (let c = pos.col + 1; c < wall.size.cols; c++) {
    if (wall.grid.has(positionKey({ row: pos.row, col: c }))) {
      horizontalCount++;
    } else {
      break;
    }
  }

  // Check vertical line
  let verticalCount = 1; // The tile itself
  // Check up
  for (let r = pos.row - 1; r >= 0; r--) {
    if (wall.grid.has(positionKey({ row: r, col: pos.col }))) {
      verticalCount++;
    } else {
      break;
    }
  }
  // Check down
  for (let r = pos.row + 1; r < wall.size.rows; r++) {
    if (wall.grid.has(positionKey({ row: r, col: pos.col }))) {
      verticalCount++;
    } else {
      break;
    }
  }

  // Score calculation
  if (horizontalCount > 1 && verticalCount > 1) {
    score = horizontalCount + verticalCount;
  } else if (horizontalCount > 1) {
    score = horizontalCount;
  } else if (verticalCount > 1) {
    score = verticalCount;
  } else {
    score = 1; // Isolated tile
  }

  return score;
}

// Check if any adjacent tile restricts the placed tile
function checkTypeRestriction(
  placedTile: PokemonTile,
  pos: Position,
  wall: Wall
): boolean {
  const adjacentPositions = getAdjacentPositions(pos, wall);

  for (const adjPos of adjacentPositions) {
    const adjTileId = wall.grid.get(positionKey(adjPos));
    if (adjTileId) {
      const adjTile = wall.tiles.get(adjTileId);
      if (adjTile && restricts(adjTile.type, placedTile.type)) {
        return true;
      }
    }
  }

  return false;
}

// Place a tile on the wall
export function placeTile(
  wall: Wall,
  tile: PokemonTile,
  pos: Position
): PlacementResult {
  // Check if position is valid
  if (
    pos.row < 0 ||
    pos.row >= wall.size.rows ||
    pos.col < 0 ||
    pos.col >= wall.size.cols
  ) {
    throw new Error('Position out of bounds');
  }

  const key = positionKey(pos);

  // Check if position is occupied
  if (wall.grid.has(key)) {
    throw new Error('Position already occupied');
  }

  // Create new wall state
  const newWall: Wall = {
    tiles: new Map(wall.tiles),
    grid: new Map(wall.grid),
    size: wall.size,
  };

  // Calculate base adjacency score
  const baseScore = calculateAdjacencyScore(pos, wall);

  // Check type restriction
  const hasRestriction = checkTypeRestriction(tile, pos, wall);

  // Create new tile with updated state
  let newTile: PokemonTile = { ...tile };
  let scoreGained = baseScore;

  if (hasRestriction) {
    // Apply penalty
    scoreGained = Math.max(0, baseScore - 1);
    newTile = {
      ...tile,
      penaltyCount: tile.penaltyCount + 1,
      injured: true,
      score: tile.score + scoreGained,
    };
  } else {
    newTile = {
      ...tile,
      score: tile.score + scoreGained,
    };
  }

  // Check kill rule
  if (newTile.penaltyCount >= 2) {
    // Tile is killed, don't place it
    return {
      wall,
      scoreGained: 0,
      tileKilled: true,
    };
  }

  // Place tile
  newWall.tiles.set(tile.id, newTile);
  newWall.grid.set(key, tile.id);

  return {
    wall: newWall,
    scoreGained,
    tileKilled: false,
  };
}

// Match heal: remove injured state from a tile
export function matchHeal(wall: Wall, tileId: string): Wall {
  const tile = wall.tiles.get(tileId);

  if (!tile) {
    throw new Error('Tile not found');
  }

  if (!tile.injured) {
    // Already healed, no change
    return wall;
  }

  const newWall: Wall = {
    tiles: new Map(wall.tiles),
    grid: new Map(wall.grid),
    size: wall.size,
  };

  const healedTile: PokemonTile = {
    ...tile,
    injured: false,
  };

  newWall.tiles.set(tileId, healedTile);

  return newWall;
}

// Get tile at position
export function getTileAtPosition(wall: Wall, pos: Position): PokemonTile | null {
  const key = positionKey(pos);
  const tileId = wall.grid.get(key);
  if (!tileId) {
    return null;
  }
  return wall.tiles.get(tileId) ?? null;
}
