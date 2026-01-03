import { initGame, takeTiles, placeToPatternLine } from './azulGame';
import type { AzulState } from './azulTypes';

describe('Azul UI Flow - Pattern Lines Visibility', () => {
  test('takeTiles + placeToPatternLine should update state without hiding pattern lines', () => {
    // Initialize game with 2 players
    let state: AzulState = initGame(2);

    // Player 1 takes tiles from factory 0
    const factory = state.factories[0];
    const color = factory.tiles[0].color;

    // Step 1-2: Take tiles from factory
    state = takeTiles(state, 'factory', 0, color);

    // Verify tiles were taken
    expect(state.takenTiles).toBeDefined();
    expect(state.takenTiles!.length).toBeGreaterThan(0);
    expect(state.phase).toBe('factory-offer'); // Still in factory-offer phase

    // Step 3: Place tiles on pattern line 0
    const stateBeforePlacement = { ...state };
    state = placeToPatternLine(state, 0);

    // Verify pattern line was updated
    const player = state.players[0];
    expect(player.patternLines[0].tiles.length).toBeGreaterThan(0);
    expect(player.patternLines[0].color).toBe(color);

    // Verify pattern lines still exist (not cleared)
    expect(player.patternLines).toHaveLength(5);
    player.patternLines.forEach((line, idx) => {
      expect(line).toBeDefined();
      expect(line.capacity).toBe(idx + 1);
    });

    // Verify phase hasn't jumped to wall-tiling (unless all factories empty)
    // In normal case (taking from one factory), phase should still be factory-offer
    if (state.factories.every(f => f.tiles.length === 0) && state.center.tiles.length === 0) {
      expect(state.phase).toBe('wall-tiling');
    } else {
      expect(state.phase).toBe('factory-offer');
    }
  });

  test('pattern lines should persist across player turns', () => {
    let state: AzulState = initGame(2);

    // Player 1 places tiles
    const factory1 = state.factories[0];
    const color1 = factory1.tiles[0].color;
    state = takeTiles(state, 'factory', 0, color1);
    state = placeToPatternLine(state, 0);

    const player1Line0BeforeSwitch = state.players[0].patternLines[0].tiles.length;

    // Player 2's turn (if phase is still factory-offer)
    if (state.phase === 'factory-offer') {
      const factory2 = state.factories.find(f => f.tiles.length > 0);
      if (factory2) {
        const color2 = factory2.tiles[0].color;
        state = takeTiles(state, 'factory', factory2.id, color2);
        state = placeToPatternLine(state, 1);
      }
    }

    // Verify Player 1's pattern lines still have their tiles
    expect(state.players[0].patternLines[0].tiles.length).toBe(player1Line0BeforeSwitch);

    // Both players should have pattern lines
    state.players.forEach((player) => {
      expect(player.patternLines).toHaveLength(5);
    });
  });
});
