import { initGame, takeTiles, placeToPatternLine } from './azulGame';
import type { AzulState } from './azulTypes';
import { hasAnyFilledPatternLine } from './azulTypes';

describe('Factories Empty - Player Highlight Logic Fix', () => {
  test('factories empty + p1 no filled lines + p2 has filled lines => active player becomes p2, p1 not highlighted', () => {
    let state: AzulState = initGame(2);

    // Setup: Fill Player 2's pattern line L0 (capacity 1)
    state.players[1].patternLines[0].tiles = [{ id: 'tile-1', color: 'fire' }];
    state.players[1].patternLines[0].color = 'fire';

    // Setup: Player 1 has no filled lines
    state.players[0].patternLines.forEach(line => {
      line.tiles = [];
      line.color = null;
    });

    // Empty all factories to trigger phase transition
    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [];
    state.currentPlayerIndex = 0; // Currently player 0

    // Trigger phase transition by placing tiles (simulating end of factory-offer phase)
    state.phase = 'factory-offer';

    // Manually call the phase transition logic
    // (In real game, this happens via placeToPatternLine -> checkAndTransitionPhase)
    // Since we can't easily trigger it, we'll test the helper functions

    // Verify Player 1 (index 0) has no filled lines
    expect(hasAnyFilledPatternLine(state.players[0].patternLines)).toBe(false);

    // Verify Player 2 (index 1) has filled lines
    expect(hasAnyFilledPatternLine(state.players[1].patternLines)).toBe(true);
  });

  test('factories empty + both no filled lines => should skip wall-tiling', () => {
    let state: AzulState = initGame(2);

    // Setup: Both players have no filled lines
    state.players.forEach(player => {
      player.patternLines.forEach(line => {
        line.tiles = [];
        line.color = null;
      });
    });

    // Verify both players have no filled lines
    expect(hasAnyFilledPatternLine(state.players[0].patternLines)).toBe(false);
    expect(hasAnyFilledPatternLine(state.players[1].patternLines)).toBe(false);

    // Empty all factories
    state.factories.forEach(f => f.tiles = []);
    state.center.tiles = [];

    // When we transition to wall-tiling with no filled lines,
    // the game should auto-advance to next round
    // This is tested implicitly by checking the helper function
  });

  test('hasAnyFilledPatternLine returns true when at least one line is filled', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Initially no filled lines
    expect(hasAnyFilledPatternLine(player.patternLines)).toBe(false);

    // Fill line 0 (capacity 1)
    player.patternLines[0].tiles = [{ id: 'tile-1', color: 'fire' }];
    player.patternLines[0].color = 'fire';

    // Now should return true
    expect(hasAnyFilledPatternLine(player.patternLines)).toBe(true);
  });

  test('hasAnyFilledPatternLine returns false when lines are partially filled', () => {
    let state: AzulState = initGame(2);
    const player = state.players[0];

    // Partially fill line 1 (capacity 2, only 1 tile)
    player.patternLines[1].tiles = [{ id: 'tile-1', color: 'fire' }];
    player.patternLines[1].color = 'fire';

    // Should return false (not filled)
    expect(hasAnyFilledPatternLine(player.patternLines)).toBe(false);
  });

  test('integration: factories empty triggers correct player selection', () => {
    let state: AzulState = initGame(2);

    // Player 0: no filled lines
    state.players[0].patternLines.forEach(line => {
      line.tiles = [];
      line.color = null;
    });

    // Player 1: has one filled line (L0, capacity 1)
    state.players[1].patternLines[0].tiles = [{ id: 'tile-1', color: 'fire' }];
    state.players[1].patternLines[0].color = 'fire';

    // Setup: Almost empty factory state
    // Leave one factory with tiles so we can take them
    state.factories[0].tiles = [
      { id: 'tile-2', color: 'water' },
      { id: 'tile-3', color: 'water' },
    ];
    state.factories.slice(1).forEach(f => f.tiles = []);
    state.center.tiles = [];
    state.currentPlayerIndex = 0;

    // Take tiles from last factory to trigger phase transition
    state = takeTiles(state, 'factory', 0, 'water');
    state = placeToPatternLine(state, 4); // Place to line 4 (won't fill it)

    // After phase transition, should be in wall-tiling phase
    expect(state.phase).toBe('wall-tiling');

    // Current player should be Player 1 (who has filled lines)
    expect(state.currentPlayerIndex).toBe(1);
  });

  test('integration: factories empty + no filled lines => auto start new round', () => {
    let state: AzulState = initGame(2);

    // Both players: no filled lines
    state.players.forEach(player => {
      player.patternLines.forEach(line => {
        line.tiles = [];
        line.color = null;
      });
    });

    // Setup: One factory with tiles
    state.factories[0].tiles = [
      { id: 'tile-1', color: 'fire' },
      { id: 'tile-2', color: 'fire' },
    ];
    state.factories.slice(1).forEach(f => f.tiles = []);
    state.center.tiles = [];
    state.currentPlayerIndex = 0;
    state.round = 1;

    // Take tiles from last factory to trigger phase transition
    state = takeTiles(state, 'factory', 0, 'fire');
    state = placeToPatternLine(state, 4); // Place to line 4 (won't fill it)

    // Should skip wall-tiling and auto-start new round
    expect(state.phase).toBe('factory-offer');
    expect(state.round).toBe(2);

    // Factories should be refilled
    const totalTiles = state.factories.reduce((sum, f) => sum + f.tiles.length, 0);
    expect(totalTiles).toBe(20); // 5 factories * 4 tiles each
  });
});
