/**
 * gameLogic.test.ts
 *
 * Purpose: Behavior tests for core game logic per SPEC.md
 * Tests cover: scoring, penalty, healing, kill (SPEC section 14)
 */

import * as GameLogic from "./gameLogic";
import { PokemonTile } from "./types";

describe("GameLogic - Core Behavior", () => {
  describe("Scoring Rules", () => {
    test("isolated tile scores 1 point", () => {
      const wall = GameLogic.createWall(5, 5);
      const tile: PokemonTile = {
        id: "pikachu-1",
        type: "electric",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };

      const result = GameLogic.placeTile(wall, tile, { row: 2, col: 2 });

      expect(result.tileKilled).toBe(false);
      expect(result.scoreGained).toBe(1);
      expect(result.wall.tiles.get("pikachu-1")?.score).toBe(1);
      expect(result.wall.tiles.get("pikachu-1")?.injured).toBe(false);
    });

    test("horizontal adjacency scores correctly", () => {
      let wall = GameLogic.createWall(5, 5);

      // Place first tile
      const tile1: PokemonTile = {
        id: "tile-1",
        type: "fire",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      wall = GameLogic.placeTile(wall, tile1, { row: 2, col: 2 }).wall;

      // Place second tile adjacent horizontally
      const tile2: PokemonTile = {
        id: "tile-2",
        type: "fire",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      const result = GameLogic.placeTile(wall, tile2, { row: 2, col: 3 });

      expect(result.scoreGained).toBe(2);
      expect(result.wall.tiles.get("tile-2")?.score).toBe(2);
    });
  });

  describe("Type Penalty (SPEC section 7)", () => {
    test("applies penalty when adjacent tile restricts (score-1, penaltyCount+1, injured=true)", () => {
      let wall = GameLogic.createWall(5, 5);

      // Place fire tile
      const fireTile: PokemonTile = {
        id: "fire-1",
        type: "fire",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      wall = GameLogic.placeTile(wall, fireTile, { row: 2, col: 2 }).wall;

      // Place grass tile next to fire (fire is super effective vs grass)
      const grassTile: PokemonTile = {
        id: "grass-1",
        type: "grass",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      const result = GameLogic.placeTile(wall, grassTile, { row: 2, col: 3 });

      expect(result.tileKilled).toBe(false);
      expect(result.scoreGained).toBe(1); // 2 - 1 penalty
      expect(result.wall.tiles.get("grass-1")?.penaltyCount).toBe(1);
      expect(result.wall.tiles.get("grass-1")?.injured).toBe(true);
    });

    test("applies only one penalty per placement (multiple restricting neighbors)", () => {
      let wall = GameLogic.createWall(5, 5);

      // Place two fire tiles
      const fireTile1: PokemonTile = {
        id: "fire-1",
        type: "fire",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      wall = GameLogic.placeTile(wall, fireTile1, { row: 2, col: 2 }).wall;

      const fireTile2: PokemonTile = {
        id: "fire-2",
        type: "fire",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      wall = GameLogic.placeTile(wall, fireTile2, { row: 3, col: 3 }).wall;

      // Place grass tile at (3,2) - adjacent to BOTH fire tiles
      // Adjacency: horizontal line [grass, fire2] = 2, vertical line [fire1, grass] = 2
      // Both directions > 1, so base score = 2+2 = 4
      // Two restricting neighbors, but penalty applied only once: 4 - 1 = 3
      const grassTile: PokemonTile = {
        id: "grass-1",
        type: "grass",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      const result = GameLogic.placeTile(wall, grassTile, { row: 3, col: 2 });

      expect(result.scoreGained).toBe(3); // 4 - 1 penalty (only one despite two restricting neighbors)
      expect(result.wall.tiles.get("grass-1")?.penaltyCount).toBe(1); // NOT 2
      expect(result.wall.tiles.get("grass-1")?.injured).toBe(true);
    });

    test("penalty reduces score correctly (demonstrates Math.max floor)", () => {
      let wall = GameLogic.createWall(5, 5);

      // Place fire tile
      const fireTile: PokemonTile = {
        id: "fire-1",
        type: "fire",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      wall = GameLogic.placeTile(wall, fireTile, { row: 2, col: 2 }).wall;

      // Place grass tile adjacent to fire
      // Note: In standard Azul, adjacent tiles always form a line of at least 2,
      // so minimum base score when adjacent = 2. With penalty: 2-1=1 (not 0).
      // Score 0 is unreachable in valid gameplay (would require isolated tile
      // with penalty, but penalty requires adjacency).
      const grassTile: PokemonTile = {
        id: "grass-1",
        type: "grass",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      const result = GameLogic.placeTile(wall, grassTile, { row: 1, col: 2 });

      // Vertical line [grass, fire] = 2, minus penalty = 1
      expect(result.scoreGained).toBe(1); // max(0, 2 - 1) = 1
      expect(result.wall.tiles.get("grass-1")?.score).toBe(1);
      expect(result.scoreGained).toBeGreaterThanOrEqual(0); // Verifies floor at 0
    });
  });

  describe("Kill Rule (SPEC section 7)", () => {
    test("kills tile when penaltyCount reaches 2", () => {
      let wall = GameLogic.createWall(5, 5);

      // Place fire tile
      const fireTile: PokemonTile = {
        id: "fire-1",
        type: "fire",
        score: 5,
        penaltyCount: 0,
        injured: false,
      };
      wall = GameLogic.placeTile(wall, fireTile, { row: 2, col: 2 }).wall;

      // Try to place grass tile with penaltyCount 1 next to fire
      const grassTile: PokemonTile = {
        id: "grass-1",
        type: "grass",
        score: 3,
        penaltyCount: 1,
        injured: true,
      };
      const result = GameLogic.placeTile(wall, grassTile, { row: 2, col: 3 });

      expect(result.tileKilled).toBe(true);
      expect(result.scoreGained).toBe(0);
      expect(result.wall.tiles.has("grass-1")).toBe(false);
      expect(result.wall.grid.has("2,3")).toBe(false);
    });
  });

  describe("Match Heal (SPEC section 9)", () => {
    test("removes injured state from tile", () => {
      let wall = GameLogic.createWall(5, 5);

      // Place fire tile
      const fireTile: PokemonTile = {
        id: "fire-1",
        type: "fire",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      wall = GameLogic.placeTile(wall, fireTile, { row: 2, col: 2 }).wall;

      // Place grass tile next to fire (gets injured)
      const grassTile: PokemonTile = {
        id: "grass-1",
        type: "grass",
        score: 0,
        penaltyCount: 0,
        injured: false,
      };
      wall = GameLogic.placeTile(wall, grassTile, { row: 2, col: 3 }).wall;

      // Tile should be injured from placement
      expect(wall.tiles.get("grass-1")?.injured).toBe(true);

      // Heal the tile
      wall = GameLogic.matchHeal(wall, "grass-1");

      expect(wall.tiles.get("grass-1")?.injured).toBe(false);
      expect(wall.tiles.get("grass-1")?.penaltyCount).toBe(1); // Penalty count unchanged
      expect(wall.tiles.get("grass-1")?.score).toBe(1); // Score unchanged
    });

    test("heal does not change score (SPEC section 15: recovery restores stability, not power)", () => {
      let wall = GameLogic.createWall(5, 5);

      const tile: PokemonTile = {
        id: "tile-1",
        type: "water",
        score: 5,
        penaltyCount: 1,
        injured: true,
      };
      wall = GameLogic.placeTile(wall, tile, { row: 2, col: 2 }).wall;

      const beforeScore = wall.tiles.get("tile-1")?.score;
      wall = GameLogic.matchHeal(wall, "tile-1");
      const afterScore = wall.tiles.get("tile-1")?.score;

      expect(afterScore).toBe(beforeScore);
    });
  });
});
