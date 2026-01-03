# Pokémon Azul UI

Playable UI implementation for Pokémon Azul game, built with React + TypeScript + Vite.

## Features (Definition of Done ✓)

- ✅ **Tiles can be placed**: Select a Pokémon type from the left panel and click an empty cell on the 5x5 wall
- ✅ **Score updates correctly**: Total score is displayed at the top-right and updates based on game engine calculations
- ✅ **Injured tiles show red border**: Tiles with `injured === true` display a red border and ⚡ symbol
- ✅ **Healing removes border**: Click an injured tile to heal it (removes injury, score unchanged)
- ✅ **Killed tiles disappear**: Tiles with `penaltyCount >= 2` are killed and don't appear on the wall

## Architecture

- **Game Engine**: `../src/gameLogic.ts` (imports from `../src/core.ts`)
- **UI Layer**: React components in `src/components/`
  - `WallGrid.tsx`: 5x5 player wall
  - `TileSource.tsx`: Tile type selector
  - `ScoreDisplay.tsx`: Score display
  - `App.tsx`: Main game state and interaction handlers

## Running the UI

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Game Rules

1. Select a Pokémon type from the left panel
2. Click an empty cell on the wall to place the tile
3. Score is calculated using standard Azul adjacency rules
4. If an adjacent tile is super effective against the placed tile:
   - Tile gets injured (red border ⚡)
   - Score is reduced by 1 (minimum 0)
   - `penaltyCount` increases by 1
5. Click an injured tile to heal it (removes injury marker)
6. If a tile reaches `penaltyCount >= 2`, it's killed and disappears from the wall

## Type Effectiveness Examples

- Fire is super effective vs Grass
- Water is super effective vs Fire
- Grass is super effective vs Water
- Electric is super effective vs Water
- And more... (see `../src/typeEffectiveness.ts`)

## UI State Management

- **Pure game state**: All game logic is handled by the engine (`placeTile`, `matchHeal`)
- **UI state**: React useState manages `wall`, `totalScore`, `selectedType`
- **No rule duplication**: UI displays engine results, doesn't re-implement game rules
