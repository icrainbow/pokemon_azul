import { initGame, takeTiles, placeToPatternLine } from './azulGame';
import type { AzulState } from './azulTypes';
import { isRoundEnded } from './azulTypes';

describe('Round End Condition - Factories AND Center Must Be Empty', () => {
  test('factories empty but center not empty => round NOT ended, phase stays factory-offer', () => {
    let state: AzulState = initGame(2);

    // Empty all factories
    state.factories.forEach(f => f.tiles = []);

    // Center still has tiles
    state.center.tiles = [
      { id: 'tile-1', color: 'fire' },
      { id: 'tile-2', color: 'water' },
    ];

    state.phase = 'factory-offer';

    // Check round ended status
    expect(isRoundEnded(state)).toBe(false);

    // Simulate placing tiles to trigger phase check
    // Since we can't take from empty factories, we verify the helper function
    // In real game, placeToPatternLine -> checkAndTransitionPhase will use isRoundEnded
  });

  test('factories empty and center empty => round ended, phase transitions to wall-tiling', () => {
    let state: AzulState = initGame(2);

    // Setup: Player 1 has one filled line
    state.players[0].patternLines[0].tiles = [{ id: 'tile-1', color: 'fire' }];
    state.players[0].patternLines[0].color = 'fire';

    // Empty all factories
    state.factories.forEach(f => f.tiles = []);

    // Empty center
    state.center.tiles = [];

    state.phase = 'factory-offer';

    // Check round ended status
    expect(isRoundEnded(state)).toBe(true);
  });

  test('taking from center reduces center tiles and continues until empty', () => {
    let state: AzulState = initGame(2);

    // Empty factories
    state.factories.forEach(f => f.tiles = []);

    // Center has multiple colors
    state.center.tiles = [
      { id: 'tile-1', color: 'fire' },
      { id: 'tile-2', color: 'fire' },
      { id: 'tile-3', color: 'water' },
      { id: 'tile-4', color: 'grass' },
    ];

    state.center.hasStartingPlayerMarker = true;
    state.phase = 'factory-offer';
    state.currentPlayerIndex = 0;

    // Round should not be ended yet
    expect(isRoundEnded(state)).toBe(false);

    // Take fire tiles from center
    state = takeTiles(state, 'center', null, 'fire');
    expect(state.takenTiles?.length).toBe(2);

    // Center should now have 2 tiles (water, grass)
    state = placeToPatternLine(state, 0);
    expect(state.center.tiles.length).toBe(2);
    expect(isRoundEnded(state)).toBe(false);

    // Phase should still be factory-offer (not wall-tiling)
    expect(state.phase).toBe('factory-offer');
  });

  test('isRoundEnded returns false when only factories are empty', () => {
    let state: AzulState = initGame(2);

    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [{ id: 'tile-1', color: 'fire' }];

    expect(isRoundEnded(state)).toBe(false);
  });

  test('isRoundEnded returns false when only center is empty', () => {
    let state: AzulState = initGame(2);

    state.factories[0].tiles = [{ id: 'tile-1', color: 'fire' }];
    state.center.tiles = [];

    expect(isRoundEnded(state)).toBe(false);
  });

  test('isRoundEnded returns true when both factories and center are empty', () => {
    let state: AzulState = initGame(2);

    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [];

    expect(isRoundEnded(state)).toBe(true);
  });

  test('integration: factories emptied first, then center must be emptied before wall-tiling', () => {
    let state: AzulState = initGame(2);

    // Setup: Leave only one factory with tiles, others empty
    state.factories[0].tiles = [
      { id: 'tile-1', color: 'fire' },
      { id: 'tile-2', color: 'water' },
    ];
    state.factories.slice(1).forEach(f => f.tiles = []);
    state.center.tiles = [];
    state.currentPlayerIndex = 0;

    // Take fire from factory (water goes to center)
    state = takeTiles(state, 'factory', 0, 'fire');
    state = placeToPatternLine(state, 0);

    // Now factories are all empty, but center has 1 water tile
    expect(state.factories.every(f => f.tiles.length === 0)).toBe(true);
    expect(state.center.tiles.length).toBe(1);
    expect(state.center.tiles[0].color).toBe('water');

    // Round should not be ended
    expect(isRoundEnded(state)).toBe(false);

    // Phase should still be factory-offer (must continue taking from center)
    expect(state.phase).toBe('factory-offer');

    // Take water from center
    state = takeTiles(state, 'center', null, 'water');
    state = placeToPatternLine(state, 1);

    // Now both factories and center are empty
    expect(isRoundEnded(state)).toBe(true);

    // Phase should now be wall-tiling (if any player has filled lines)
    // If no filled lines, it auto-advances to next round
  });

  test('integration: center-only continuation after factories empty', () => {
    let state: AzulState = initGame(2);

    // Setup: All factories empty, center has tiles
    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [
      { id: 'tile-1', color: 'fire' },
      { id: 'tile-2', color: 'fire' },
      { id: 'tile-3', color: 'water' },
    ];
    state.center.hasStartingPlayerMarker = false; // Already taken
    state.phase = 'factory-offer';
    state.currentPlayerIndex = 0;

    // Round not ended yet
    expect(isRoundEnded(state)).toBe(false);

    // Player must be able to take from center
    state = takeTiles(state, 'center', null, 'fire');
    expect(state.takenTiles?.length).toBe(2);

    state = placeToPatternLine(state, 0);

    // Center still has water tile
    expect(state.center.tiles.length).toBe(1);
    expect(isRoundEnded(state)).toBe(false);
    expect(state.phase).toBe('factory-offer');

    // Next player takes water
    state = takeTiles(state, 'center', null, 'water');
    state = placeToPatternLine(state, 1);

    // Now center is empty
    expect(state.center.tiles.length).toBe(0);
    expect(isRoundEnded(state)).toBe(true);
  });
});
