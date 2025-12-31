/**
 * gameLogic.ts
 *
 * Purpose: Re-export core game logic functions for test discovery and orchestrator.
 * The actual implementation lives in core.ts.
 */

export {
  createWall,
  placeTile,
  matchHeal,
  getTileAtPosition,
} from './core';

export type {
  PokemonType,
  PokemonTile,
  Position,
  Wall,
  PlacementResult,
} from './types';
