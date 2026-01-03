import {
  initGame,
  createSeededRng,
  detectTriples,
  selectTripleToActivate,
  chooseAttackTarget,
  applyAttack,
  checkAndExecuteTripleAttack,
  placePatternLineToWall,
} from './azulGame';
import type { AzulState, Wall, WallTile } from './azulTypes';

describe('Triple Attack Feature', () => {
  // Helper to create a wall with specific tiles
  function createWallWithTiles(tiles: Array<{ row: number; col: number; color: string; koStatus?: boolean; injured?: boolean; timestamp?: number }>): Wall {
    const grid: (WallTile | null)[][] = Array(5)
      .fill(null)
      .map(() => Array(5).fill(null));

    for (const tile of tiles) {
      grid[tile.row][tile.col] = {
        color: tile.color as any,
        penaltyCount: tile.injured ? 1 : 0,
        injured: tile.injured || false,
        koStatus: tile.koStatus || false,
        placementTimestamp: tile.timestamp || Date.now(),
      };
    }

    return { grid };
  }

  describe('createSeededRng', () => {
    test('generates deterministic random numbers', () => {
      const rng1 = createSeededRng(42);
      const values1 = [rng1(), rng1(), rng1()];

      const rng2 = createSeededRng(42);
      const values2 = [rng2(), rng2(), rng2()];

      expect(values1).toEqual(values2);
    });

    test('generates different sequences for different seeds', () => {
      const rng1 = createSeededRng(42);
      const rng2 = createSeededRng(100);

      expect(rng1()).not.toBe(rng2());
    });

    test('generates values between 0 and 1', () => {
      const rng = createSeededRng(42);
      for (let i = 0; i < 100; i++) {
        const value = rng();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });
  });

  describe('detectTriples', () => {
    test('detects single triple (3 fire tiles)', () => {
      const wall = createWallWithTiles([
        { row: 0, col: 0, color: 'fire', timestamp: 1 },
        { row: 1, col: 1, color: 'fire', timestamp: 2 },
        { row: 2, col: 2, color: 'fire', timestamp: 3 },
      ]);

      const triples = detectTriples(wall);
      expect(triples).toHaveLength(1);
      expect(triples[0].type).toBe('fire');
      expect(triples[0].tiles).toHaveLength(3);
    });

    test('detects multiple triples (3 fire, 4 water)', () => {
      const wall = createWallWithTiles([
        { row: 0, col: 0, color: 'fire', timestamp: 1 },
        { row: 1, col: 1, color: 'fire', timestamp: 2 },
        { row: 2, col: 2, color: 'fire', timestamp: 3 },
        { row: 0, col: 1, color: 'water', timestamp: 4 },
        { row: 1, col: 2, color: 'water', timestamp: 5 },
        { row: 2, col: 3, color: 'water', timestamp: 6 },
        { row: 3, col: 4, color: 'water', timestamp: 7 },
      ]);

      const triples = detectTriples(wall);
      expect(triples).toHaveLength(2);
      expect(triples.some(t => t.type === 'fire')).toBe(true);
      expect(triples.some(t => t.type === 'water')).toBe(true);
    });

    test('excludes KO tiles from triple counting', () => {
      const wall = createWallWithTiles([
        { row: 0, col: 0, color: 'fire', timestamp: 1 },
        { row: 1, col: 1, color: 'fire', timestamp: 2, koStatus: true },
        { row: 2, col: 2, color: 'fire', timestamp: 3 },
      ]);

      const triples = detectTriples(wall);
      expect(triples).toHaveLength(0); // Only 2 alive fire tiles
    });

    test('includes injured tiles in triple counting', () => {
      const wall = createWallWithTiles([
        { row: 0, col: 0, color: 'fire', timestamp: 1, injured: true },
        { row: 1, col: 1, color: 'fire', timestamp: 2 },
        { row: 2, col: 2, color: 'fire', timestamp: 3 },
      ]);

      const triples = detectTriples(wall);
      expect(triples).toHaveLength(1);
      expect(triples[0].tiles).toHaveLength(3);
    });

    test('returns empty if no triple exists', () => {
      const wall = createWallWithTiles([
        { row: 0, col: 0, color: 'fire', timestamp: 1 },
        { row: 1, col: 1, color: 'water', timestamp: 2 },
        { row: 2, col: 2, color: 'grass', timestamp: 3 },
        { row: 3, col: 3, color: 'electric', timestamp: 4 },
      ]);

      const triples = detectTriples(wall);
      expect(triples).toHaveLength(0);
    });

    test('sorts tiles by timestamp within each type', () => {
      const wall = createWallWithTiles([
        { row: 0, col: 0, color: 'fire', timestamp: 300 },
        { row: 1, col: 1, color: 'fire', timestamp: 100 },
        { row: 2, col: 2, color: 'fire', timestamp: 200 },
      ]);

      const triples = detectTriples(wall);
      expect(triples[0].tiles[0].timestamp).toBe(100);
      expect(triples[0].tiles[1].timestamp).toBe(200);
      expect(triples[0].tiles[2].timestamp).toBe(300);
    });
  });

  describe('selectTripleToActivate', () => {
    test('selects fire over water when both are triples', () => {
      const candidates = [
        {
          type: 'water' as any,
          tiles: [
            { row: 0, col: 0, timestamp: 1 },
            { row: 1, col: 1, timestamp: 2 },
            { row: 2, col: 2, timestamp: 3 },
          ],
        },
        {
          type: 'fire' as any,
          tiles: [
            { row: 0, col: 1, timestamp: 4 },
            { row: 1, col: 2, timestamp: 5 },
            { row: 2, col: 3, timestamp: 6 },
          ],
        },
      ];

      const selected = selectTripleToActivate(candidates);
      expect(selected?.type).toBe('fire');
    });

    test('selects earliest placed tiles by timestamp (takes first 3)', () => {
      const candidates = [
        {
          type: 'fire' as any,
          tiles: [
            { row: 0, col: 0, timestamp: 100 },
            { row: 1, col: 1, timestamp: 200 },
            { row: 2, col: 2, timestamp: 300 },
            { row: 3, col: 3, timestamp: 400 },
          ],
        },
      ];

      const selected = selectTripleToActivate(candidates);
      expect(selected?.tiles).toHaveLength(3);
      expect(selected?.tiles[0].timestamp).toBe(100);
      expect(selected?.tiles[1].timestamp).toBe(200);
      expect(selected?.tiles[2].timestamp).toBe(300);
    });

    test('returns null if no candidates', () => {
      const selected = selectTripleToActivate([]);
      expect(selected).toBeNull();
    });

    test('follows type priority order', () => {
      const candidates = [
        { type: 'psychic' as any, tiles: [{ row: 0, col: 0, timestamp: 1 }, { row: 1, col: 1, timestamp: 2 }, { row: 2, col: 2, timestamp: 3 }] },
        { type: 'grass' as any, tiles: [{ row: 0, col: 1, timestamp: 1 }, { row: 1, col: 2, timestamp: 2 }, { row: 2, col: 3, timestamp: 3 }] },
        { type: 'water' as any, tiles: [{ row: 0, col: 2, timestamp: 1 }, { row: 1, col: 3, timestamp: 2 }, { row: 2, col: 4, timestamp: 3 }] },
      ];

      const selected = selectTripleToActivate(candidates);
      expect(selected?.type).toBe('water'); // Water has higher priority than grass and psychic
    });
  });

  describe('chooseAttackTarget', () => {
    test('selects tile deterministically with seeded RNG', () => {
      const wall = createWallWithTiles([
        { row: 0, col: 0, color: 'fire', timestamp: 1 },
        { row: 1, col: 1, color: 'water', timestamp: 2 },
        { row: 2, col: 2, color: 'grass', timestamp: 3 },
      ]);

      const rng1 = createSeededRng(42);
      const target1 = chooseAttackTarget(wall, rng1);

      const rng2 = createSeededRng(42);
      const target2 = chooseAttackTarget(wall, rng2);

      expect(target1).toEqual(target2);
    });

    test('never selects KO tiles', () => {
      const wall = createWallWithTiles([
        { row: 0, col: 0, color: 'fire', timestamp: 1 },
        { row: 1, col: 1, color: 'water', timestamp: 2, koStatus: true },
        { row: 2, col: 2, color: 'grass', timestamp: 3, koStatus: true },
      ]);

      const rng = createSeededRng(42);
      const target = chooseAttackTarget(wall, rng);

      expect(target).toEqual({ row: 0, col: 0 }); // Only non-KO tile
    });

    test('returns null if all tiles are KO', () => {
      const wall = createWallWithTiles([
        { row: 0, col: 0, color: 'fire', timestamp: 1, koStatus: true },
        { row: 1, col: 1, color: 'water', timestamp: 2, koStatus: true },
      ]);

      const rng = createSeededRng(42);
      const target = chooseAttackTarget(wall, rng);

      expect(target).toBeNull();
    });

    test('can select injured tiles (they are valid targets)', () => {
      const wall = createWallWithTiles([
        { row: 0, col: 0, color: 'fire', timestamp: 1, injured: true },
      ]);

      const rng = createSeededRng(42);
      const target = chooseAttackTarget(wall, rng);

      expect(target).toEqual({ row: 0, col: 0 });
    });
  });

  describe('applyAttack', () => {
    test('healthy tile becomes injured', () => {
      const wall = createWallWithTiles([
        { row: 2, col: 3, color: 'water', timestamp: 1 },
      ]);

      const outcome = applyAttack(wall, 2, 3);

      expect(outcome).toBe('injured');
      expect(wall.grid[2][3]?.injured).toBe(true);
      expect(wall.grid[2][3]?.koStatus).toBe(false);
      expect(wall.grid[2][3]?.penaltyCount).toBeGreaterThanOrEqual(1);
    });

    test('injured tile becomes KO', () => {
      const wall = createWallWithTiles([
        { row: 1, col: 4, color: 'fire', timestamp: 1, injured: true },
      ]);

      const outcome = applyAttack(wall, 1, 4);

      expect(outcome).toBe('ko');
      expect(wall.grid[1][4]?.koStatus).toBe(true);
      expect(wall.grid[1][4]?.injured).toBe(true); // Remains true
    });

    test('throws error if no tile at position', () => {
      const wall = createWallWithTiles([]);

      expect(() => applyAttack(wall, 0, 0)).toThrow('No tile at target position');
    });
  });

  describe('checkAndExecuteTripleAttack - Integration', () => {
    test('attack triggers after placing 3rd tile of same type', () => {
      // Create a game with seeded RNG
      const state = initGame(2, { rng: createSeededRng(100) });

      // Manually set up walls: Player 0 will have 3 fire tiles after placement
      // Player 1 will have 1 water tile to be attacked
      state.players[0].wall.grid[0][0] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 1,
      };
      state.players[0].wall.grid[1][1] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 2,
      };

      state.players[1].wall.grid[2][2] = {
        color: 'water',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 3,
      };

      // Add a third fire tile to player 0's wall
      state.players[0].wall.grid[2][2] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: Date.now(),
      };

      // Execute triple attack
      const newState = checkAndExecuteTripleAttack(state, 0);

      // Check that attack was marked
      expect(newState.players[0].lastTripleAttackRound).toBe(state.round);

      // Check that opponent tile was affected
      const opponentWall = newState.players[1].wall;
      let hasInjuredOrKO = false;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const tile = opponentWall.grid[row][col];
          if (tile && (tile.injured || tile.koStatus)) {
            hasInjuredOrKO = true;
          }
        }
      }
      expect(hasInjuredOrKO).toBe(true);
    });

    test('only one attack per player per round', () => {
      const state = initGame(2, { rng: createSeededRng(100) });

      // Set up 3 fire tiles for player 0
      state.players[0].wall.grid[0][0] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 1,
      };
      state.players[0].wall.grid[1][1] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 2,
      };
      state.players[0].wall.grid[2][2] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 3,
      };

      // Set up opponent with 2 tiles
      state.players[1].wall.grid[0][0] = {
        color: 'water',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 10,
      };
      state.players[1].wall.grid[1][1] = {
        color: 'water',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 11,
      };

      // First attack
      let newState = checkAndExecuteTripleAttack(state, 0);
      expect(newState.players[0].lastTripleAttackRound).toBe(state.round);

      // Count injured tiles after first attack
      let injuredCount = 0;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const tile = newState.players[1].wall.grid[row][col];
          if (tile && tile.injured) injuredCount++;
        }
      }
      expect(injuredCount).toBe(1);

      // Second attack in same round should not execute
      newState = checkAndExecuteTripleAttack(newState, 0);

      // Count injured tiles - should still be 1
      let injuredCountAfter = 0;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const tile = newState.players[1].wall.grid[row][col];
          if (tile && tile.injured) injuredCountAfter++;
        }
      }
      expect(injuredCountAfter).toBe(1); // No change
    });

    test('attack resets in next round (can attack again)', () => {
      const state = initGame(2, { rng: createSeededRng(100) });
      state.round = 1;

      // Set up triple
      state.players[0].wall.grid[0][0] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 1,
      };
      state.players[0].wall.grid[1][1] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 2,
      };
      state.players[0].wall.grid[2][2] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 3,
      };

      // Set up opponent with 2 tiles
      state.players[1].wall.grid[0][0] = {
        color: 'water',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 10,
      };
      state.players[1].wall.grid[1][1] = {
        color: 'grass',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 11,
      };

      // Round 1 attack
      let newState = checkAndExecuteTripleAttack(state, 0);
      expect(newState.players[0].lastTripleAttackRound).toBe(1);

      // Move to round 2
      newState.round = 2;

      // Should be able to attack again
      newState = checkAndExecuteTripleAttack(newState, 0);
      expect(newState.players[0].lastTripleAttackRound).toBe(2);
    });

    test('attack fizzles if opponent has no alive tiles', () => {
      const state = initGame(2, { rng: createSeededRng(100) });

      // Set up triple for player 0
      state.players[0].wall.grid[0][0] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 1,
      };
      state.players[0].wall.grid[1][1] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 2,
      };
      state.players[0].wall.grid[2][2] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 3,
      };

      // Set up opponent with all KO tiles
      state.players[1].wall.grid[0][0] = {
        color: 'water',
        penaltyCount: 2,
        injured: true,
        koStatus: true,
        placementTimestamp: 10,
      };

      // Execute attack - should fizzle but mark as attacked
      const newState = checkAndExecuteTripleAttack(state, 0);
      expect(newState.players[0].lastTripleAttackRound).toBe(state.round);
      // No crash, graceful handling
    });

    test('KO tiles do not count toward future triples', () => {
      const state = initGame(2, { rng: createSeededRng(100) });

      // Set up player 0 with 2 alive fire + 1 KO fire
      state.players[0].wall.grid[0][0] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 1,
      };
      state.players[0].wall.grid[1][1] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 2,
      };
      state.players[0].wall.grid[2][2] = {
        color: 'fire',
        penaltyCount: 2,
        injured: true,
        koStatus: true,
        placementTimestamp: 3,
      };

      // Should not detect triple (only 2 alive)
      const newState = checkAndExecuteTripleAttack(state, 0);
      expect(newState.players[0].lastTripleAttackRound).toBeNull();
    });

    test('injured opponent tile becomes KO on attack', () => {
      const state = initGame(2, { rng: createSeededRng(42) });

      // Set up triple for player 0
      state.players[0].wall.grid[0][0] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 1,
      };
      state.players[0].wall.grid[1][1] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 2,
      };
      state.players[0].wall.grid[2][2] = {
        color: 'fire',
        penaltyCount: 0,
        injured: false,
        koStatus: false,
        placementTimestamp: 3,
      };

      // Set up opponent with injured tile
      state.players[1].wall.grid[0][0] = {
        color: 'water',
        penaltyCount: 1,
        injured: true,
        koStatus: false,
        placementTimestamp: 10,
      };

      // Execute attack
      const newState = checkAndExecuteTripleAttack(state, 0);

      // Check that injured tile became KO
      const targetTile = newState.players[1].wall.grid[0][0];
      expect(targetTile?.koStatus).toBe(true);
    });
  });
});
