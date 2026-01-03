import { initGame, takeTiles, placeToPatternLine, placePatternLineToWall } from './azulGame';
import type { AzulState } from './azulTypes';
import { rowHasColor, canPlaceOnWall, canPlaceToPatternLine, hasValidPatternLineForColor } from './azulTypes';

describe('Row Uniqueness Rule', () => {
  test('rowHasColor detects existing color in row', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];
    state.phase = 'wall-tiling';

    // Place a fire tile at row 2, col 2
    player.patternLines[2].tiles = [
      { id: 'tile-1', color: 'fire' },
      { id: 'tile-2', color: 'fire' },
      { id: 'tile-3', color: 'fire' },
    ];
    player.patternLines[2].color = 'fire';
    state = placePatternLineToWall(state, 0, 2, 2, 2);

    // Row 2 should now have fire
    expect(rowHasColor(state.players[0].wall, 2, 'fire')).toBe(true);
    expect(rowHasColor(state.players[0].wall, 2, 'water')).toBe(false);
    expect(rowHasColor(state.players[0].wall, 1, 'fire')).toBe(false);
  });

  test('canPlaceOnWall rejects placing same type in row', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];
    state.phase = 'wall-tiling';

    // Place a fire tile at row 2, col 2
    player.patternLines[2].tiles = [
      { id: 'tile-1', color: 'fire' },
      { id: 'tile-2', color: 'fire' },
      { id: 'tile-3', color: 'fire' },
    ];
    player.patternLines[2].color = 'fire';
    state = placePatternLineToWall(state, 0, 2, 2, 2);

    // Should NOT be able to place another fire tile anywhere else in row 2
    expect(canPlaceOnWall(state.players[0].wall, 2, 0, 'fire')).toBe(false);
    expect(canPlaceOnWall(state.players[0].wall, 2, 1, 'fire')).toBe(false);
    expect(canPlaceOnWall(state.players[0].wall, 2, 3, 'fire')).toBe(false);
    expect(canPlaceOnWall(state.players[0].wall, 2, 4, 'fire')).toBe(false);

    // Should be able to place fire in other rows
    expect(canPlaceOnWall(state.players[0].wall, 0, 0, 'fire')).toBe(true);
    expect(canPlaceOnWall(state.players[0].wall, 1, 0, 'fire')).toBe(true);

    // Should be able to place other colors in row 2
    expect(canPlaceOnWall(state.players[0].wall, 2, 0, 'water')).toBe(true);
    expect(canPlaceOnWall(state.players[0].wall, 2, 1, 'grass')).toBe(true);
  });

  test('canPlaceToPatternLine rejects tiles when row already has that type', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];
    state.phase = 'wall-tiling';

    // Place electric at row 1 (via pattern line 1)
    player.patternLines[1].tiles = [
      { id: 'tile-1', color: 'electric' },
      { id: 'tile-2', color: 'electric' },
    ];
    player.patternLines[1].color = 'electric';
    state = placePatternLineToWall(state, 0, 1, 1, 1);

    // Pattern line 1 corresponds to wall row 1
    // Should NOT be able to place electric tiles to pattern line 1 anymore
    expect(canPlaceToPatternLine(state.players[0], 1, 'electric')).toBe(false);

    // Should be able to place electric to other pattern lines
    expect(canPlaceToPatternLine(state.players[0], 0, 'electric')).toBe(true);
    expect(canPlaceToPatternLine(state.players[0], 2, 'electric')).toBe(true);

    // Should be able to place other colors to pattern line 1
    expect(canPlaceToPatternLine(state.players[0], 1, 'water')).toBe(true);
  });

  test('pattern line rejects tiles when wall row has that color', () => {
    let state: AzulState = initGame(2);
    state.phase = 'factory-offer';
    const player = state.players[0];

    // Place psychic at row 3
    player.wall.grid[3][2] = {
      color: 'psychic',
      penaltyCount: 0,
      injured: false,
      koStatus: false,
    };

    // Try to add psychic tiles to pattern line 3 (maps to row 3)
    expect(canPlaceToPatternLine(player, 3, 'psychic')).toBe(false);

    // Should work for other pattern lines
    expect(canPlaceToPatternLine(player, 0, 'psychic')).toBe(true);
    expect(canPlaceToPatternLine(player, 2, 'psychic')).toBe(true);
  });
});

describe('Auto-Floor for Invalid Tiles', () => {
  test('tiles go to floor when no valid pattern lines exist', () => {
    let state: AzulState = initGame(2);

    // Block all pattern lines for player 0 by filling them with different colors or making rows invalid
    const player = state.players[0];

    // Fill pattern line 0 with water
    player.patternLines[0].tiles = [{ id: 'pl0-1', color: 'water' }];
    player.patternLines[0].color = 'water';

    // Fill pattern line 1 completely with fire
    player.patternLines[1].tiles = [
      { id: 'pl1-1', color: 'fire' },
      { id: 'pl1-2', color: 'fire' },
    ];
    player.patternLines[1].color = 'fire';

    // Fill pattern line 2 completely with grass
    player.patternLines[2].tiles = [
      { id: 'pl2-1', color: 'grass' },
      { id: 'pl2-2', color: 'grass' },
      { id: 'pl2-3', color: 'grass' },
    ];
    player.patternLines[2].color = 'grass';

    // Pattern line 3: put electric in wall row 3
    player.wall.grid[3][1] = {
      color: 'electric',
      penaltyCount: 0,
      injured: false,
      koStatus: false,
    };

    // Pattern line 4: also put electric in wall row 4
    player.wall.grid[4][2] = {
      color: 'electric',
      penaltyCount: 0,
      injured: false,
      koStatus: false,
    };

    // Now try to take electric tiles
    // No pattern line can accept electric:
    // L0: has water
    // L1: full with fire
    // L2: full with grass
    // L3: wall row 3 already has electric
    // L4: wall row 4 already has electric
    expect(hasValidPatternLineForColor(player, 'electric')).toBe(false);

    // Take electric tiles from factory 0
    const factory = state.factories[0];
    factory.tiles = [
      { id: 'f0-1', color: 'electric' },
      { id: 'f0-2', color: 'electric' },
      { id: 'f0-3', color: 'fire' },
      { id: 'f0-4', color: 'water' },
    ];

    const initialFloorCount = player.floorLine.tiles.length;
    state = takeTiles(state, 'factory', 0, 'electric');

    // Should have auto-floored the tiles
    expect(state.players[0].floorLine.tiles.length).toBe(initialFloorCount + 2);
    expect(state.autoFlooredTiles).toBe(true);

    // Should have moved to next player
    expect(state.currentPlayerIndex).toBe(1);
  });

  test('tiles do not auto-floor when valid pattern line exists', () => {
    let state: AzulState = initGame(2);

    // Pattern line 0 is empty and valid
    const factory = state.factories[0];
    factory.tiles = [
      { id: 'f0-1', color: 'water' },
      { id: 'f0-2', color: 'water' },
      { id: 'f0-3', color: 'fire' },
      { id: 'f0-4', color: 'grass' },
    ];

    state = takeTiles(state, 'factory', 0, 'water');

    // Should NOT auto-floor - player needs to choose pattern line
    expect(state.autoFlooredTiles).toBeUndefined();
    expect(state.takenTiles).toBeDefined();
    expect(state.takenTiles?.length).toBe(2);
    expect(state.currentPlayerIndex).toBe(0); // Still current player's turn
  });

  test('hasValidPatternLineForColor works correctly', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Initially all pattern lines are valid for any color
    expect(hasValidPatternLineForColor(player, 'fire')).toBe(true);
    expect(hasValidPatternLineForColor(player, 'water')).toBe(true);

    // Fill all pattern lines
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < i + 1; j++) {
        player.patternLines[i].tiles.push({ id: `p${i}-${j}`, color: 'fire' });
      }
      player.patternLines[i].color = 'fire';
    }

    // Now no line can accept fire (all full of fire)
    expect(hasValidPatternLineForColor(player, 'fire')).toBe(false);

    // But other colors should still have valid lines
    // Actually, they can't because all lines are full
    expect(hasValidPatternLineForColor(player, 'water')).toBe(false);

    // Clear one line
    player.patternLines[2].tiles = [];
    player.patternLines[2].color = null;

    // Now water should be valid for line 2
    expect(hasValidPatternLineForColor(player, 'water')).toBe(true);
  });
});
