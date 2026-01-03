import {
  initGame,
  takeTiles,
  placeToPatternLine,
  healTile,
} from './azulGame';
import type { AzulState, TileColor } from './azulTypes';

describe('Azul Game Logic', () => {
  describe('initGame', () => {
    test('initializes game with 2 players correctly', () => {
      const state = initGame(2);

      expect(state.players).toHaveLength(2);
      expect(state.factories).toHaveLength(5); // 2 players = 5 factories
      expect(state.bag.length + state.factories.reduce((sum, f) => sum + f.tiles.length, 0)).toBe(100);
      expect(state.phase).toBe('factory-offer');
      expect(state.round).toBe(1);
    });

    test('initializes game with 4 players correctly', () => {
      const state = initGame(4);

      expect(state.players).toHaveLength(4);
      expect(state.factories).toHaveLength(9); // 4 players = 9 factories
    });

    test('throws error for invalid player count', () => {
      expect(() => initGame(1)).toThrow();
      expect(() => initGame(5)).toThrow();
    });
  });

  describe('takeTiles', () => {
    test('takes tiles from factory and moves remainder to center', () => {
      const state = initGame(2);
      const factory = state.factories[0];
      const originalFactoryTiles = [...factory.tiles];
      const color: TileColor = factory.tiles[0].color;

      const tilesOfColor = factory.tiles.filter((t) => t.color === color);
      const remainingTiles = factory.tiles.filter((t) => t.color !== color);

      const newState = takeTiles(state, 'factory', 0, color) as any;

      expect(newState.takenTiles).toHaveLength(tilesOfColor.length);
      expect(newState.takenTiles.every((t: any) => t.color === color)).toBe(true);
      expect(newState.factories[0].tiles).toHaveLength(0);
      expect(newState.center.tiles).toHaveLength(state.center.tiles.length + remainingTiles.length);
    });

    test('takes starting player marker when taking from center first time', () => {
      let state = initGame(2);

      // Move some tiles to center first
      state.center.tiles = [{ id: 'tile-test', color: 'fire' }];

      const newState = takeTiles(state, 'center', null, 'fire') as any;

      expect(newState.players[0].floorLine.hasStartingPlayerMarker).toBe(true);
      expect(newState.center.hasStartingPlayerMarker).toBe(false);
      expect(newState.players[0].isStartingPlayer).toBe(true);
    });
  });

  describe('placeToPatternLine', () => {
    test('places tiles to pattern line correctly', () => {
      let state = initGame(2) as any;

      // Take some tiles
      state.takenTiles = [
        { id: 'tile-1', color: 'fire' },
        { id: 'tile-2', color: 'fire' },
      ];

      const newState = placeToPatternLine(state, 1); // Place in line 1 (capacity 2)

      const player = newState.players[0];
      expect(player.patternLines[1].tiles).toHaveLength(2);
      expect(player.patternLines[1].color).toBe('fire');
    });

    test('overflow tiles go to floor line', () => {
      let state = initGame(2) as any;

      // Take more tiles than line capacity
      state.takenTiles = [
        { id: 'tile-1', color: 'fire' },
        { id: 'tile-2', color: 'fire' },
        { id: 'tile-3', color: 'fire' },
      ];

      const newState = placeToPatternLine(state, 0); // Place in line 0 (capacity 1)

      const player = newState.players[0];
      expect(player.patternLines[0].tiles).toHaveLength(1);
      expect(player.floorLine.tiles).toHaveLength(2);
    });

    test('cannot place tiles if wall row already has this color', () => {
      let state = initGame(2) as any;

      // Place a fire tile on the wall in row 1
      state.players[0].wall.grid[1][2] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };

      // Try to place fire tiles in pattern line 1 (same row)
      state.takenTiles = [
        { id: 'tile-1', color: 'fire' },
        { id: 'tile-2', color: 'fire' },
      ];

      // Should throw error
      expect(() => placeToPatternLine(state, 1)).toThrow('Cannot place tiles: wall row already has this color');
    });

    test('can place tiles if wall row has different color', () => {
      let state = initGame(2) as any;

      // Place a water tile on the wall in row 1
      state.players[0].wall.grid[1][2] = {
        color: 'water',
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };

      // Place fire tiles in pattern line 1 (same row, but different color)
      state.takenTiles = [
        { id: 'tile-1', color: 'fire' },
        { id: 'tile-2', color: 'fire' },
      ];

      // Should succeed
      const newState = placeToPatternLine(state, 1);
      expect(newState.players[0].patternLines[1].tiles).toHaveLength(2);
      expect(newState.players[0].patternLines[1].color).toBe('fire');
    });
  });

  // NOTE: wallTilingPhase tests removed - now using manual placePatternLineToWall (see azulGame.walltiling.test.ts)

  describe('healTile', () => {
    test('heals an injured tile', () => {
      let state = initGame(2);
      const player = state.players[0];

      // Place an injured tile
      player.wall.grid[0][0] = {
        color: 'fire',
        penaltyCount: 1,
        injured: true,
      koStatus: false,
      };

      const newState = healTile(state, 0, 0, 0);

      expect(newState.players[0].wall.grid[0][0]?.injured).toBe(false);
      expect(newState.players[0].wall.grid[0][0]?.penaltyCount).toBe(1); // Penalty count unchanged
    });

    test('throws error if tile is not injured', () => {
      let state = initGame(2);
      state.players[0].wall.grid[0][0] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };

      expect(() => healTile(state, 0, 0, 0)).toThrow();
    });
  });
});
