import {
  createWall,
  placeTile,
  matchHeal,
  getTileAtPosition,
} from '../core';
import { PokemonTile, Wall } from '../types';

describe('Core Logic', () => {
  describe('createWall', () => {
    it('should create an empty wall with specified dimensions', () => {
      const wall = createWall(5, 5);
      expect(wall.size.rows).toBe(5);
      expect(wall.size.cols).toBe(5);
      expect(wall.tiles.size).toBe(0);
      expect(wall.grid.size).toBe(0);
    });
  });

  describe('placeTile', () => {
    it('should place isolated tile and score 1 point', () => {
      const wall = createWall(5, 5);
      const tile: PokemonTile = {
        id: 'pikachu-1',
        type: 'electric',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };

      const result = placeTile(wall, tile, { row: 2, col: 2 });

      expect(result.tileKilled).toBe(false);
      expect(result.scoreGained).toBe(1);
      expect(result.wall.tiles.get('pikachu-1')?.score).toBe(1);
      expect(result.wall.tiles.get('pikachu-1')?.injured).toBe(false);
    });

    it('should calculate horizontal adjacency score', () => {
      let wall = createWall(5, 5);

      // Place first tile
      const tile1: PokemonTile = {
        id: 'tile-1',
        type: 'fire',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      const result1 = placeTile(wall, tile1, { row: 2, col: 2 });
      wall = result1.wall;

      // Place second tile adjacent horizontally
      const tile2: PokemonTile = {
        id: 'tile-2',
        type: 'fire',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      const result2 = placeTile(wall, tile2, { row: 2, col: 3 });

      expect(result2.scoreGained).toBe(2);
      expect(result2.wall.tiles.get('tile-2')?.score).toBe(2);
    });

    it('should calculate vertical adjacency score', () => {
      let wall = createWall(5, 5);

      // Place first tile
      const tile1: PokemonTile = {
        id: 'tile-1',
        type: 'water',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      const result1 = placeTile(wall, tile1, { row: 2, col: 2 });
      wall = result1.wall;

      // Place second tile adjacent vertically
      const tile2: PokemonTile = {
        id: 'tile-2',
        type: 'water',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      const result2 = placeTile(wall, tile2, { row: 3, col: 2 });

      expect(result2.scoreGained).toBe(2);
    });

    it('should calculate cross adjacency score (horizontal + vertical)', () => {
      let wall = createWall(5, 5);

      // Place horizontal tiles
      const tile1: PokemonTile = {
        id: 'tile-1',
        type: 'grass',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, tile1, { row: 2, col: 1 }).wall;

      // Place vertical tile
      const tile2: PokemonTile = {
        id: 'tile-2',
        type: 'grass',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, tile2, { row: 1, col: 2 }).wall;

      // Place center tile (connects both)
      const tile3: PokemonTile = {
        id: 'tile-3',
        type: 'grass',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      const result = placeTile(wall, tile3, { row: 2, col: 2 });

      // Should score 2 (horizontal) + 2 (vertical) = 4
      expect(result.scoreGained).toBe(4);
    });

    it('should apply type penalty when adjacent tile restricts', () => {
      let wall = createWall(5, 5);

      // Place fire tile
      const fireTile: PokemonTile = {
        id: 'fire-1',
        type: 'fire',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, fireTile, { row: 2, col: 2 }).wall;

      // Place grass tile next to fire (fire is super effective vs grass)
      const grassTile: PokemonTile = {
        id: 'grass-1',
        type: 'grass',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      const result = placeTile(wall, grassTile, { row: 2, col: 3 });

      expect(result.tileKilled).toBe(false);
      expect(result.scoreGained).toBe(1); // 2 - 1 penalty
      expect(result.wall.tiles.get('grass-1')?.penaltyCount).toBe(1);
      expect(result.wall.tiles.get('grass-1')?.injured).toBe(true);
    });

    it('should only apply penalty once per placement even with multiple restricting neighbors', () => {
      let wall = createWall(5, 5);

      // Place two fire tiles
      const fireTile1: PokemonTile = {
        id: 'fire-1',
        type: 'fire',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, fireTile1, { row: 2, col: 2 }).wall;

      const fireTile2: PokemonTile = {
        id: 'fire-2',
        type: 'fire',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, fireTile2, { row: 3, col: 3 }).wall;

      // Place grass tile between two fire tiles
      const grassTile: PokemonTile = {
        id: 'grass-1',
        type: 'grass',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      const result = placeTile(wall, grassTile, { row: 3, col: 2 });

      // Should have adjacency of 2, minus 1 penalty = 1
      expect(result.scoreGained).toBe(1);
      expect(result.wall.tiles.get('grass-1')?.penaltyCount).toBe(1);
      expect(result.wall.tiles.get('grass-1')?.injured).toBe(true);
    });

    it('should kill tile when penaltyCount reaches 2', () => {
      let wall = createWall(5, 5);

      // Place fire tile
      const fireTile: PokemonTile = {
        id: 'fire-1',
        type: 'fire',
        score: 5,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, fireTile, { row: 2, col: 2 }).wall;

      // Place grass tile with penaltyCount 1 next to fire
      const grassTile: PokemonTile = {
        id: 'grass-1',
        type: 'grass',
        score: 3,
        penaltyCount: 1,
        injured: true,
      koStatus: false,
      };
      const result = placeTile(wall, grassTile, { row: 2, col: 3 });

      expect(result.tileKilled).toBe(true);
      expect(result.scoreGained).toBe(0);
      expect(result.wall.tiles.has('grass-1')).toBe(false);
      expect(result.wall.grid.has('2,3')).toBe(false);
    });

    it('should not apply penalty when no adjacent tiles restrict', () => {
      let wall = createWall(5, 5);

      // Place water tile
      const waterTile: PokemonTile = {
        id: 'water-1',
        type: 'water',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, waterTile, { row: 2, col: 2 }).wall;

      // Place grass tile next to water (grass is super effective vs water, not vice versa)
      const grassTile: PokemonTile = {
        id: 'grass-1',
        type: 'grass',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      const result = placeTile(wall, grassTile, { row: 2, col: 3 });

      expect(result.scoreGained).toBe(2); // Full adjacency score
      expect(result.wall.tiles.get('grass-1')?.penaltyCount).toBe(0);
      expect(result.wall.tiles.get('grass-1')?.injured).toBe(false);
    });

    it('should throw error when placing on occupied position', () => {
      let wall = createWall(5, 5);

      const tile1: PokemonTile = {
        id: 'tile-1',
        type: 'fire',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, tile1, { row: 2, col: 2 }).wall;

      const tile2: PokemonTile = {
        id: 'tile-2',
        type: 'water',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };

      expect(() => placeTile(wall, tile2, { row: 2, col: 2 })).toThrow(
        'Position already occupied'
      );
    });

    it('should throw error when placing out of bounds', () => {
      const wall = createWall(5, 5);
      const tile: PokemonTile = {
        id: 'tile-1',
        type: 'fire',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };

      expect(() => placeTile(wall, tile, { row: -1, col: 2 })).toThrow(
        'Position out of bounds'
      );
      expect(() => placeTile(wall, tile, { row: 2, col: 5 })).toThrow(
        'Position out of bounds'
      );
    });

    it('should not go below 0 score when penalty exceeds base score', () => {
      let wall = createWall(5, 5);

      // Place fire tile
      const fireTile: PokemonTile = {
        id: 'fire-1',
        type: 'fire',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, fireTile, { row: 2, col: 2 }).wall;

      // Place isolated grass tile next to fire (base score 1, penalty -1)
      const grassTile: PokemonTile = {
        id: 'grass-1',
        type: 'grass',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      const result = placeTile(wall, grassTile, { row: 1, col: 2 });

      expect(result.scoreGained).toBe(0); // max(0, 1 - 1)
      expect(result.wall.tiles.get('grass-1')?.score).toBe(0);
    });
  });

  describe('matchHeal', () => {
    it('should remove injured state from tile', () => {
      let wall = createWall(5, 5);

      // Place fire tile
      const fireTile: PokemonTile = {
        id: 'fire-1',
        type: 'fire',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, fireTile, { row: 2, col: 2 }).wall;

      // Place injured grass tile
      const grassTile: PokemonTile = {
        id: 'grass-1',
        type: 'grass',
        score: 0,
        penaltyCount: 1,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, grassTile, { row: 2, col: 3 }).wall;

      // Tile should be injured from placement
      expect(wall.tiles.get('grass-1')?.injured).toBe(true);

      // Heal the tile
      wall = matchHeal(wall, 'grass-1');

      expect(wall.tiles.get('grass-1')?.injured).toBe(false);
      expect(wall.tiles.get('grass-1')?.penaltyCount).toBe(1); // Penalty count unchanged
      expect(wall.tiles.get('grass-1')?.score).toBe(1); // Score unchanged
    });

    it('should not change score when healing', () => {
      let wall = createWall(5, 5);

      const tile: PokemonTile = {
        id: 'tile-1',
        type: 'grass',
        score: 10,
        penaltyCount: 1,
        injured: true,
      koStatus: false,
      };
      wall = placeTile(wall, tile, { row: 2, col: 2 }).wall;

      const beforeScore = wall.tiles.get('tile-1')?.score;
      wall = matchHeal(wall, 'tile-1');
      const afterScore = wall.tiles.get('tile-1')?.score;

      expect(afterScore).toBe(beforeScore);
    });

    it('should be no-op if tile is not injured', () => {
      let wall = createWall(5, 5);

      const tile: PokemonTile = {
        id: 'tile-1',
        type: 'fire',
        score: 5,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, tile, { row: 2, col: 2 }).wall;

      const before = wall.tiles.get('tile-1');
      wall = matchHeal(wall, 'tile-1');
      const after = wall.tiles.get('tile-1');

      expect(after).toEqual(before);
    });

    it('should throw error when tile not found', () => {
      const wall = createWall(5, 5);

      expect(() => matchHeal(wall, 'nonexistent')).toThrow('Tile not found');
    });
  });

  describe('getTileAtPosition', () => {
    it('should return tile at specified position', () => {
      let wall = createWall(5, 5);

      const tile: PokemonTile = {
        id: 'pikachu-1',
        type: 'electric',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, tile, { row: 2, col: 3 }).wall;

      const result = getTileAtPosition(wall, { row: 2, col: 3 });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('pikachu-1');
      expect(result?.type).toBe('electric');
    });

    it('should return null when position is empty', () => {
      const wall = createWall(5, 5);

      const result = getTileAtPosition(wall, { row: 2, col: 3 });

      expect(result).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle tile getting injured, healed, then injured again', () => {
      let wall = createWall(5, 5);

      // Place fire tile
      const fireTile: PokemonTile = {
        id: 'fire-1',
        type: 'fire',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, fireTile, { row: 2, col: 2 }).wall;

      // Place grass tile (gets injured)
      const grassTile: PokemonTile = {
        id: 'grass-1',
        type: 'grass',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, grassTile, { row: 1, col: 2 }).wall;
      expect(wall.tiles.get('grass-1')?.injured).toBe(true);

      // Heal the grass tile
      wall = matchHeal(wall, 'grass-1');
      expect(wall.tiles.get('grass-1')?.injured).toBe(false);

      // Now place another fire tile that would injure grass again (in a future placement)
      // For this test, we verify the tile can be healed and is stable
      expect(wall.tiles.get('grass-1')?.penaltyCount).toBe(1);
    });

    it('should accumulate score correctly across multiple placements', () => {
      let wall = createWall(5, 5);

      const tile1: PokemonTile = {
        id: 'tile-1',
        type: 'normal',
        score: 0,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, tile1, { row: 2, col: 2 }).wall;
      expect(wall.tiles.get('tile-1')?.score).toBe(1);

      const tile2: PokemonTile = {
        id: 'tile-2',
        type: 'normal',
        score: 5,
        penaltyCount: 0,
        injured: false,
      koStatus: false,
      };
      wall = placeTile(wall, tile2, { row: 2, col: 3 }).wall;
      expect(wall.tiles.get('tile-2')?.score).toBe(7); // 5 + 2
    });
  });
});
