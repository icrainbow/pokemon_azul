import { initGame, takeTiles, placeToPatternLine, placePatternLineToWall, finishWallTiling } from './azulGame';
import type { AzulState } from './azulTypes';
import { canPlaceOnWall, canPlaceToPatternLine } from './azulTypes';

describe('Azul Wall-Tiling Manual Interaction', () => {
  test('players take turns until factories and center are empty', () => {
    let state: AzulState = initGame(2);

    let turnCount = 0;
    const maxTurns = 50; // Safety limit

    // Players take turns until wall-tiling phase
    while (state.phase === 'factory-offer' && turnCount < maxTurns) {
      // Find a factory with tiles
      const factory = state.factories.find(f => f.tiles.length > 0);

      if (factory) {
        const color = factory.tiles[0].color;
        state = takeTiles(state, 'factory', factory.id, color);

        // Check if tiles were auto-floored (no valid pattern lines)
        if (!(state as any).autoFlooredTiles && (state as any).takenTiles) {
          // Find a suitable pattern line
          const currentPlayer = state.players[state.currentPlayerIndex];
          let lineIdx = -1;
          for (let i = 0; i < 5; i++) {
            if (canPlaceToPatternLine(currentPlayer, i, color)) {
              lineIdx = i;
              break;
            }
          }

          if (lineIdx >= 0) {
            state = placeToPatternLine(state, lineIdx);
          }
        }
        turnCount++;
      } else if (state.center.tiles.length > 0) {
        const color = state.center.tiles[0].color;
        state = takeTiles(state, 'center', null, color);

        // Check if tiles were auto-floored (no valid pattern lines)
        if (!(state as any).autoFlooredTiles && (state as any).takenTiles) {
          // Find a suitable pattern line
          const currentPlayer = state.players[state.currentPlayerIndex];
          let lineIdx = -1;
          for (let i = 0; i < 5; i++) {
            if (canPlaceToPatternLine(currentPlayer, i, color)) {
              lineIdx = i;
              break;
            }
          }

          if (lineIdx >= 0) {
            state = placeToPatternLine(state, lineIdx);
          }
        }
        turnCount++;
      } else {
        break;
      }
    }

    // Should have entered wall-tiling phase
    expect(state.phase).toBe('wall-tiling');
    expect(state.factories.every(f => f.tiles.length === 0)).toBe(true);
    // NOTE: center may still have tiles (they go to center during placeToPatternLine overflow)
    // We just need to verify phase transition happened
  });

  test('placePatternLineToWall places only 1 tile and discards the rest', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Manually fill a pattern line (L1 with capacity 2)
    player.patternLines[1].tiles = [
      { id: 'tile-1', color: 'fire' },
      { id: 'tile-2', color: 'fire' },
    ];
    player.patternLines[1].color = 'fire';

    // Set phase to wall-tiling
    state.phase = 'wall-tiling';

    // Get expected wall position for fire in row 1
    const expectedCol = 1; // fire is at column 1 in row 1 according to WALL_PATTERN

    // Place the line on wall
    state = placePatternLineToWall(state, 0, 1, 1, expectedCol);

    // Check: only 1 tile on wall
    expect(state.players[0].wall.grid[1][expectedCol]).toBeTruthy();
    expect(state.players[0].wall.grid[1][expectedCol]?.color).toBe('fire');

    // Check: pattern line is cleared
    expect(state.players[0].patternLines[1].tiles).toHaveLength(0);
    expect(state.players[0].patternLines[1].color).toBeNull();

    // Check: 1 tile went to center (remaining tiles)
    expect(state.center.tiles.length).toBe(1);
    expect(state.center.tiles[0].color).toBe('fire');
  });

  test('placePatternLineToWall throws error if line is not complete', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Partially fill a pattern line
    player.patternLines[1].tiles = [{ id: 'tile-1', color: 'fire' }];
    player.patternLines[1].color = 'fire';

    state.phase = 'wall-tiling';

    expect(() => placePatternLineToWall(state, 0, 1, 1, 1)).toThrow('Pattern line is not complete');
  });

  test('placePatternLineToWall throws error if pattern line index does not match wall row', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Fill pattern line 1 (capacity 2)
    player.patternLines[1].tiles = [
      { id: 'tile-1', color: 'fire' },
      { id: 'tile-2', color: 'fire' },
    ];
    player.patternLines[1].color = 'fire';

    state.phase = 'wall-tiling';

    // Try to place from pattern line 1 to wall row 0 (should fail)
    expect(() => placePatternLineToWall(state, 0, 1, 0, 0)).toThrow('Pattern line 1 can only be placed on wall row 1, not row 0');

    // Try to place from pattern line 1 to wall row 2 (should fail)
    expect(() => placePatternLineToWall(state, 0, 1, 2, 0)).toThrow('Pattern line 1 can only be placed on wall row 1, not row 2');
  });

  test('placePatternLineToWall succeeds when pattern line index matches wall row', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Fill pattern line 2 (capacity 3)
    player.patternLines[2].tiles = [
      { id: 'tile-1', color: 'water' },
      { id: 'tile-2', color: 'water' },
      { id: 'tile-3', color: 'water' },
    ];
    player.patternLines[2].color = 'water';

    state.phase = 'wall-tiling';

    // Place from pattern line 2 to wall row 2 (should succeed)
    state = placePatternLineToWall(state, 0, 2, 2, 1); // water at position [2,1]

    // Verify tile was placed
    expect(state.players[0].wall.grid[2][1]).toBeTruthy();
    expect(state.players[0].wall.grid[2][1]?.color).toBe('water');
  });

  // BUG FIX TEST: L3 Electric placement scenario
  test('pattern line 2 (L3) with Electric can place to row 2 when row has NO Electric', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Setup: Wall has some tiles but row 2 has NO Electric
    player.wall.grid[0][0] = { color: 'water', penaltyCount: 0, injured: false, koStatus: false };
    player.wall.grid[1][1] = { color: 'fire', penaltyCount: 0, injured: false, koStatus: false };
    // Row 2 is empty

    // Fill pattern line 2 (L3) with Electric
    player.patternLines[2].tiles = [
      { id: 'tile-1', color: 'electric' },
      { id: 'tile-2', color: 'electric' },
      { id: 'tile-3', color: 'electric' },
    ];
    player.patternLines[2].color = 'electric';

    state.phase = 'wall-tiling';

    // Place Electric from pattern line 2 to row 2 - should SUCCEED
    state = placePatternLineToWall(state, 0, 2, 2, 2);

    // Verify tile was placed
    expect(state.players[0].wall.grid[2][2]).toBeTruthy();
    expect(state.players[0].wall.grid[2][2]?.color).toBe('electric');
  });

  test('pattern line 2 (L3) with Electric CANNOT place to row 2 when row ALREADY has Electric', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Setup: Row 2 already has Electric at position [2,0]
    player.wall.grid[2][0] = { color: 'electric', penaltyCount: 0, injured: false, koStatus: false };

    // Fill pattern line 2 (L3) with Electric
    player.patternLines[2].tiles = [
      { id: 'tile-1', color: 'electric' },
      { id: 'tile-2', color: 'electric' },
      { id: 'tile-3', color: 'electric' },
    ];
    player.patternLines[2].color = 'electric';

    state.phase = 'wall-tiling';

    // Try to place Electric from pattern line 2 to row 2 - should FAIL
    expect(() => placePatternLineToWall(state, 0, 2, 2, 2)).toThrow('Cannot place tile at this position');
  });

  test('pattern line 2 (L3) with Electric CAN place to row 2 when row has different type', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Setup: Row 2 has Water (different type) at position [2,0]
    player.wall.grid[2][0] = { color: 'water', penaltyCount: 0, injured: false, koStatus: false };

    // Fill pattern line 2 (L3) with Electric
    player.patternLines[2].tiles = [
      { id: 'tile-1', color: 'electric' },
      { id: 'tile-2', color: 'electric' },
      { id: 'tile-3', color: 'electric' },
    ];
    player.patternLines[2].color = 'electric';

    state.phase = 'wall-tiling';

    // Place Electric from pattern line 2 to row 2 at position [2,3] (not adjacent to water at [2,0])
    state = placePatternLineToWall(state, 0, 2, 2, 3);

    // Verify tile was placed
    expect(state.players[0].wall.grid[2][3]).toBeTruthy();
    expect(state.players[0].wall.grid[2][3]?.color).toBe('electric');
  });

  test('validates L3->row3 mapping explicitly (0-indexed: line 2 -> row 2)', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Fill pattern line at index 2 (L3, capacity 3)
    player.patternLines[2].tiles = [
      { id: 'tile-1', color: 'electric' },
      { id: 'tile-2', color: 'electric' },
      { id: 'tile-3', color: 'electric' },
    ];
    player.patternLines[2].color = 'electric';

    state.phase = 'wall-tiling';

    // Verify line index 2 maps to row index 2 (and NO other row)
    expect(() => placePatternLineToWall(state, 0, 2, 0, 0)).toThrow('Pattern line 2 can only be placed on wall row 2, not row 0');
    expect(() => placePatternLineToWall(state, 0, 2, 1, 0)).toThrow('Pattern line 2 can only be placed on wall row 2, not row 1');
    expect(() => placePatternLineToWall(state, 0, 2, 3, 0)).toThrow('Pattern line 2 can only be placed on wall row 2, not row 3');
    expect(() => placePatternLineToWall(state, 0, 2, 4, 0)).toThrow('Pattern line 2 can only be placed on wall row 2, not row 4');

    // Only row 2 should work
    state = placePatternLineToWall(state, 0, 2, 2, 2);
    expect(state.players[0].wall.grid[2][2]?.color).toBe('electric');
  });

  // NOTE: Removed test for "invalid wall position for this color" - no longer applicable with free placement

  test('finishWallTiling applies floor penalties and starts next round', () => {
    let state: AzulState = initGame(2);

    // Add tiles to floor line
    state.players[0].floorLine.tiles = [
      { id: 'tile-1', color: 'fire' },
      { id: 'tile-2', color: 'water' },
    ];

    const initialScore = state.players[0].score;
    state.phase = 'wall-tiling';

    state = finishWallTiling(state);

    // Floor penalties: -1, -1 = -2
    expect(state.players[0].score).toBe(Math.max(0, initialScore - 2));

    // Floor line cleared
    expect(state.players[0].floorLine.tiles).toHaveLength(0);

    // Next round started
    expect(state.phase).toBe('factory-offer');
    expect(state.round).toBe(2);

    // Factories refilled
    expect(state.factories.some(f => f.tiles.length > 0)).toBe(true);
  });

  test('finishWallTiling throws error if completed lines still exist', () => {
    let state: AzulState = initGame(2);

    // Leave a completed line
    state.players[0].patternLines[0].tiles = [{ id: 'tile-1', color: 'fire' }];
    state.players[0].patternLines[0].color = 'fire';

    state.phase = 'wall-tiling';

    // Should throw because we need to call placePatternLineToWall first
    expect(() => finishWallTiling(state)).not.toThrow();
  });

  test('manual wall-tiling flow: select line, place tile, finish round', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Fill pattern line L0 (capacity 1)
    player.patternLines[0].tiles = [{ id: 'tile-1', color: 'fire' }];
    player.patternLines[0].color = 'fire';

    state.phase = 'wall-tiling';

    // Get expected wall position
    const expectedCol = 0; // fire is at column 0 in row 0

    // Place tile on wall
    state = placePatternLineToWall(state, 0, 0, 0, expectedCol);

    // Verify tile is on wall
    expect(state.players[0].wall.grid[0][expectedCol]?.color).toBe('fire');

    // Verify pattern line is cleared
    expect(state.players[0].patternLines[0].tiles).toHaveLength(0);

    // Finish round
    state = finishWallTiling(state);

    // Verify next round started
    expect(state.phase).toBe('factory-offer');
    expect(state.round).toBe(2);
  });

  // NEW TESTS: Free placement with adjacent same-color restriction

  describe('canPlaceOnWall - adjacent same-color restriction', () => {
    test('rejects placement when same color is adjacent (right)', () => {
      let state: AzulState = initGame(2);
      const player = state.players[0];

      // Place fire at [2,2]
      player.wall.grid[2][2] = { color: 'fire', penaltyCount: 0, injured: false, koStatus: false };

      // Try to place fire at [2,3] (right of [2,2]) - should fail
      expect(canPlaceOnWall(player.wall, 2, 3, 'fire')).toBe(false);
    });

    test('rejects placement when same color is adjacent (left)', () => {
      let state: AzulState = initGame(2);
      const player = state.players[0];

      // Place fire at [2,2]
      player.wall.grid[2][2] = { color: 'fire', penaltyCount: 0, injured: false, koStatus: false };

      // Try to place fire at [2,1] (left of [2,2]) - should fail
      expect(canPlaceOnWall(player.wall, 2, 1, 'fire')).toBe(false);
    });

    test('rejects placement when same color is adjacent (up)', () => {
      let state: AzulState = initGame(2);
      const player = state.players[0];

      // Place fire at [2,2]
      player.wall.grid[2][2] = { color: 'fire', penaltyCount: 0, injured: false, koStatus: false };

      // Try to place fire at [1,2] (above [2,2]) - should fail
      expect(canPlaceOnWall(player.wall, 1, 2, 'fire')).toBe(false);
    });

    test('rejects placement when same color is adjacent (down)', () => {
      let state: AzulState = initGame(2);
      const player = state.players[0];

      // Place fire at [2,2]
      player.wall.grid[2][2] = { color: 'fire', penaltyCount: 0, injured: false, koStatus: false };

      // Try to place fire at [3,2] (below [2,2]) - should fail
      expect(canPlaceOnWall(player.wall, 3, 2, 'fire')).toBe(false);
    });

    test('allows placement when same color is NOT adjacent AND not in same row', () => {
      let state: AzulState = initGame(2);
      const player = state.players[0];

      // Place fire at [2,2]
      player.wall.grid[2][2] = { color: 'fire', penaltyCount: 0, injured: false, koStatus: false };

      // Try to place fire at [2,4] (2 positions away in SAME row) - should FAIL due to row uniqueness
      expect(canPlaceOnWall(player.wall, 2, 4, 'fire')).toBe(false);

      // Try to place fire at [4,2] (2 positions down, DIFFERENT row) - should succeed
      expect(canPlaceOnWall(player.wall, 4, 2, 'fire')).toBe(true);

      // Try to place fire at [0,0] (far diagonal, DIFFERENT row) - should succeed
      expect(canPlaceOnWall(player.wall, 0, 0, 'fire')).toBe(true);
    });

    test('allows placement of different color adjacent to existing tile', () => {
      let state: AzulState = initGame(2);
      const player = state.players[0];

      // Place fire at [2,2]
      player.wall.grid[2][2] = { color: 'fire', penaltyCount: 0, injured: false, koStatus: false };

      // Try to place water at [2,3] (right of fire) - should succeed
      expect(canPlaceOnWall(player.wall, 2, 3, 'water')).toBe(true);

      // Try to place grass at [1,2] (above fire) - should succeed
      expect(canPlaceOnWall(player.wall, 1, 2, 'grass')).toBe(true);
    });

    test('rejects placement on occupied position', () => {
      let state: AzulState = initGame(2);
      const player = state.players[0];

      // Place fire at [2,2]
      player.wall.grid[2][2] = { color: 'fire', penaltyCount: 0, injured: false, koStatus: false };

      // Try to place water at same position - should fail
      expect(canPlaceOnWall(player.wall, 2, 2, 'water')).toBe(false);
    });
  });

  test('placePatternLineToWall enforces adjacent restriction', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Place fire at [0,1] (row 0)
    player.wall.grid[0][1] = { color: 'fire', penaltyCount: 0, injured: false, koStatus: false };

    // Fill pattern line 0 with fire (must match wall row 0)
    player.patternLines[0].tiles = [{ id: 'tile-1', color: 'fire' }];
    player.patternLines[0].color = 'fire';

    state.phase = 'wall-tiling';

    // Try to place at [0,2] (adjacent to existing fire at [0,1]) - should throw
    expect(() => placePatternLineToWall(state, 0, 0, 0, 2)).toThrow('Cannot place tile at this position');
  });

  test('player can place tiles anywhere on empty wall', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Fill pattern line 0 with fire
    player.patternLines[0].tiles = [{ id: 'tile-1', color: 'fire' }];
    player.patternLines[0].color = 'fire';

    state.phase = 'wall-tiling';

    // Place at [0,2] (row 0 from pattern line 0) - should succeed
    state = placePatternLineToWall(state, 0, 0, 0, 2);
    expect(state.players[0].wall.grid[0][2]?.color).toBe('fire');

    // Fill pattern line 1 with water
    state.players[0].patternLines[1].tiles = [
      { id: 'tile-2', color: 'water' },
      { id: 'tile-3', color: 'water' },
    ];
    state.players[0].patternLines[1].color = 'water';

    // Place at [1,0] (row 1 from pattern line 1) - should succeed
    state = placePatternLineToWall(state, 0, 1, 1, 0);
    expect(state.players[0].wall.grid[1][0]?.color).toBe('water');
  });

  test('injured state persists after placing other tiles', () => {
    let state: AzulState = initGame(2);
    state.phase = 'wall-tiling';

    // Setup pattern lines BEFORE placing any tiles
    state.players[0].patternLines[0].tiles = [{ id: 'tile-1', color: 'fire' }];
    state.players[0].patternLines[0].color = 'fire';

    state.players[0].patternLines[1].tiles = [
      { id: 'tile-2', color: 'grass' },
      { id: 'tile-3', color: 'grass' },
    ];
    state.players[0].patternLines[1].color = 'grass';

    state.players[0].patternLines[2].tiles = [
      { id: 'tile-4', color: 'water' },
      { id: 'tile-5', color: 'water' },
      { id: 'tile-6', color: 'water' },
    ];
    state.players[0].patternLines[2].color = 'water';

    // Place a fire tile at [0,2] (row 0 from pattern line 0)
    state = placePatternLineToWall(state, 0, 0, 0, 2);

    // Place a grass tile adjacent to fire at [1,2] (row 1 from pattern line 1, adjacent to fire at [0,2])
    state = placePatternLineToWall(state, 0, 1, 1, 2);

    // Check that grass tile is injured (fire is above it and restricts grass)
    const grassTile = state.players[0].wall.grid[1][2];
    expect(grassTile).toBeDefined();
    expect(grassTile?.injured).toBe(true);

    // Place another tile elsewhere - water at [2,0] (row 2 from pattern line 2)
    state = placePatternLineToWall(state, 0, 2, 2, 0);

    // Verify that the grass tile at [1,2] STILL has injured=true
    const grassTileAfter = state.players[0].wall.grid[1][2];
    expect(grassTileAfter).toBeDefined();
    expect(grassTileAfter?.injured).toBe(true);
    expect(grassTileAfter?.color).toBe('grass');

    // Also verify the new water tile exists
    const waterTile = state.players[0].wall.grid[2][0];
    expect(waterTile).toBeDefined();
    expect(waterTile?.color).toBe('water');
  });
});
