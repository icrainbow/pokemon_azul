# Pokémon Azul — Playable UI Specification (v1)

## 1. Goal
Build a playable single-player UI for Pokémon Azul using the existing game engine.

The game engine (core rules) is already implemented and MUST NOT be modified unless explicitly required by UI integration.

The UI must reflect game state truthfully and provide clear visual feedback for all rule effects.

---

## 2. Architecture Constraints
- Core logic lives in:
  - src/core.ts
  - src/gameLogic.ts
- UI must call these APIs, not re-implement rules.
- UI state must be a projection of game state, not an independent rule system.

Recommended stack:
- React + TypeScript
- State held in React (useState / useReducer)
- No backend required (pure frontend)

---

## 3. Layout Overview (Based on Azul Board)

Main areas:
- Top bar: Game title + live score
- Left: Tile source / pattern area
- Right: Player wall (5x5 grid, initially empty)

---

## 4. Player Wall (Right Side)

### 4.1 Grid Rules
- 5x5 grid
- No preset tile colors or types
- Empty cells are neutral placeholders
- A tile only appears when placed by the engine

### 4.2 Tile Rendering
Each placed tile must display:
- Tile type (icon or color)
- Injury state:
  - If injured === true, draw a red border
- Killed tile:
  - Tile disappears immediately

---

## 5. Tile Source (Left Side)
- Simple selectable list of Pokémon tiles
- Single selection at a time

---

## 6. Interaction Flow

### Place Tile
1. Select tile
2. Click wall cell
3. Call placeTile(wall, tile, position)
4. Update wall + score

### Heal Tile
- Click injured tile
- Call matchHeal(wall, tileId)
- Injury removed, score unchanged

---

## 7. Score Display
- Top-right numeric display
- Clear, readable
- Optional animation on increment

---

## 8. UX Principles
- Rule transparency
- Immediate feedback
- No hidden state
- Empty wall at game start

---

## 9. Definition of Done
- Tiles can be placed
- Score updates correctly
- Injured tiles show red border
- Healing removes border
- Killed tiles disappear
