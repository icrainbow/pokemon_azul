import { initGame, finishWallTiling } from './azulGame';
import type { AzulState } from './azulTypes';

describe('Finish Round - Refill Factories Bug Fix', () => {
  test('finish round starts next round with refilled factories', () => {
    let state: AzulState = initGame(2);

    // Setup: wall-tiling phase with empty factories and center
    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [];
    state.phase = 'wall-tiling';
    state.round = 1;

    // Call finishWallTiling
    const newState = finishWallTiling(state);

    // Assertions
    expect(newState.phase).toBe('factory-offer');
    expect(newState.round).toBe(2);

    // Check factories are refilled
    expect(newState.factories.length).toBe(5); // 2 players = 5 factories

    // Each factory should have 4 tiles
    newState.factories.forEach((factory, idx) => {
      expect(factory.tiles.length).toBe(4);
    });

    // Total tiles should be 20 (5 factories * 4 tiles)
    const totalTiles = newState.factories.reduce((sum, f) => sum + f.tiles.length, 0);
    expect(totalTiles).toBe(20);

    // Center should be empty (except starting player marker)
    expect(newState.center.tiles.length).toBe(0);
    expect(newState.center.hasStartingPlayerMarker).toBe(true);
  });

  test('finish round clears center tiles before starting next round', () => {
    let state: AzulState = initGame(2);

    // Setup: wall-tiling phase with center having leftover tiles
    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [
      { id: 'leftover-1', color: 'fire' },
      { id: 'leftover-2', color: 'water' },
      { id: 'leftover-3', color: 'grass' },
    ];
    state.phase = 'wall-tiling';
    state.round = 1;

    const initialLidCount = state.lid.length;

    // Call finishWallTiling
    const newState = finishWallTiling(state);

    // Center tiles should be cleared (moved to lid)
    expect(newState.center.tiles.length).toBe(0);

    // Leftover tiles should be in lid
    expect(newState.lid.length).toBe(initialLidCount + 3);

    // Factories should be refilled
    const totalTiles = newState.factories.reduce((sum, f) => sum + f.tiles.length, 0);
    expect(totalTiles).toBe(20);

    // Phase should be factory-offer
    expect(newState.phase).toBe('factory-offer');
    expect(newState.round).toBe(2);
  });

  test('finish round with empty center works correctly', () => {
    let state: AzulState = initGame(2);

    // Setup: wall-tiling phase with empty center
    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [];
    state.phase = 'wall-tiling';
    state.round = 3;

    // Call finishWallTiling
    const newState = finishWallTiling(state);

    // Should advance to next round
    expect(newState.round).toBe(4);
    expect(newState.phase).toBe('factory-offer');

    // Factories refilled
    const totalTiles = newState.factories.reduce((sum, f) => sum + f.tiles.length, 0);
    expect(totalTiles).toBe(20);

    // Center empty
    expect(newState.center.tiles.length).toBe(0);
  });

  test('finish round refills from lid when bag is empty', () => {
    let state: AzulState = initGame(2);

    // Setup: empty bag, but lid has tiles
    state.bag = [];
    state.lid = [
      { id: 'lid-1', color: 'fire' },
      { id: 'lid-2', color: 'water' },
      { id: 'lid-3', color: 'grass' },
      { id: 'lid-4', color: 'electric' },
      { id: 'lid-5', color: 'psychic' },
      // ... add 15 more to make 20 total
      ...Array.from({ length: 15 }, (_, i) => ({ id: `lid-${i + 6}`, color: 'fire' as const })),
    ];

    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [];
    state.phase = 'wall-tiling';

    // Call finishWallTiling
    const newState = finishWallTiling(state);

    // Factories should be refilled (using tiles from lid)
    const totalTiles = newState.factories.reduce((sum, f) => sum + f.tiles.length, 0);
    expect(totalTiles).toBe(20);

    // Lid should be emptied (tiles moved to bag then to factories)
    // Or bag should have remaining tiles
    const remainingTiles = newState.bag.length + newState.lid.length;
    expect(remainingTiles).toBe(0); // All 20 tiles used for factories
  });

  test('finish round applies floor penalties before starting next round', () => {
    let state: AzulState = initGame(2);

    // Setup: player has floor line tiles
    state.players[0].floorLine.tiles = [
      { id: 'floor-1', color: 'fire' },
      { id: 'floor-2', color: 'water' },
    ];
    state.players[0].score = 10;

    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [];
    state.phase = 'wall-tiling';

    // Call finishWallTiling
    const newState = finishWallTiling(state);

    // Score should have penalty applied (floor penalties: -1, -1 = -2)
    expect(newState.players[0].score).toBe(8); // 10 - 2 = 8

    // Floor line should be cleared
    expect(newState.players[0].floorLine.tiles.length).toBe(0);

    // Next round should start
    expect(newState.phase).toBe('factory-offer');
    expect(newState.factories.every(f => f.tiles.length === 4)).toBe(true);
  });

  test('finish round does not refill if game ends', () => {
    let state: AzulState = initGame(2);

    // Setup: player has 5 consecutive tiles (game end condition)
    for (let col = 0; col < 5; col++) {
      state.players[0].wall.grid[0][col] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
      };
    }

    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [];
    state.phase = 'wall-tiling';

    // Call finishWallTiling
    const newState = finishWallTiling(state);

    // Game should end
    expect(newState.phase).toBe('game-end');
    expect(newState.gameEnded).toBe(true);

    // Factories should NOT be refilled
    const totalTiles = newState.factories.reduce((sum, f) => sum + f.tiles.length, 0);
    expect(totalTiles).toBe(0);
  });
});
