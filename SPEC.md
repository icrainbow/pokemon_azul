# Pokémon Azul (Free Wall) — Agentic Vibe Coding Specification

## 1. Purpose
This project validates a fully unattended agentic vibe-coding pipeline using ChatGPT (approval & review) and Claude Code (planning & execution). The game is a vehicle to test determinism, testability, and rule clarity.

## 2. High-Level Concept
Pokémon Azul (Free Wall) adapts Azul with:
- Pokémon figures instead of colors
- Free-placement wall (no fixed pattern)
- Type effectiveness introducing risk
- Fragile scores with injury and kill mechanics
- Duplicate tiles used for risk recovery, not score inflation

## 3. Non-Goals
- Commercial release
- Publishing or distribution
- Networking or multiplayer
- Visual polish beyond functional UI
- Copyright enforcement (local execution only)

## 4. Technology Constraints
- Local execution only
- Frontend: Next.js + TypeScript
- Logic: pure functions
- Tests: mandatory unit tests
- Pokémon data may be locally cached

## 5. Core Game Entities
```ts
type PokemonTile = {
  id: string
  type: PokemonType
  score: number
  penaltyCount: number
  injured: boolean
}
```

## 6. Wall Rules
- Grid-based wall (configurable size)
- Free placement, any tile any cell
- Placement order matters

## 7. Scoring Rules
### Base Scoring
Use standard Azul adjacency rules.

### Type Penalty
If at least one adjacent tile restricts the placed tile:
- score -= 1
- penaltyCount += 1
- injured = true
Only one penalty per placement.

### Kill Rule
If penaltyCount >= 2:
- tile is removed
- score lost

## 8. Injured State (⚡)
- Represents instability, not score
- Can be removed once via healing
- May reappear after future penalties

## 9. Match Heal Rule
- Discard one matching Pokémon from hand
- Target same-type wall tile
- If injured: injured = false
- Score unchanged

## 10. Buffer Rules
- Limited capacity
- Stores excess figures
- Used for later placement or healing

## 11. Turn Structure
1. Select figures
2. Fill rows
3. Place one tile
4. Resolve scoring, penalty, kill
5. Optional healing

## 12. Game End
- Azul-style round completion
- Only surviving tiles score

## 13. Automation Requirements
- Planner: Claude Code
- Executor: Claude Code
- Reviewer: ChatGPT
- Pure functions only
- Unit-testable state transitions

## 14. Acceptance Criteria
- All rules implemented
- Tests cover scoring, penalty, healing, kill
- Reviewable via diff + tests

## 15. Design Principle
Score represents achievement.
Injury represents risk.
Recovery restores stability, not power.
