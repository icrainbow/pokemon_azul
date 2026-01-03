# 回合结束条件修正 - 完整实现报告

## ✅ 实现状态：100% 完成

所有要求的功能已完整实现并通过测试（48/48 PASS）。

---

## 🐛 问题描述

**原问题**：
- 当前实现把 "所有 factories 为空" 当作本轮结束的触发点
- **但 Azul 规则**：回合结束必须是 "所有 factories 为空 **AND** center 也为空"
- 即：center 中的 tiles（包括从 factories 倒入的剩余 tiles）也必须被玩家拿完，才算本轮结束

---

## ✅ 实现的修复

### 1. 新增 Helper 函数

**`src/azulTypes.ts`** - 新增 `isRoundEnded()`：

```typescript
// Check if the round has ended (all factories AND center are empty)
export function isRoundEnded(state: Pick<AzulState, 'factories' | 'center'>): boolean {
  const allFactoriesEmpty = state.factories.every(f => f.tiles.length === 0);
  const centerEmpty = state.center.tiles.length === 0;
  return allFactoriesEmpty && centerEmpty;
}
```

**作用**：判断回合是否结束，必须同时满足：
- 所有 factories 为空（每个 factory tiles.length === 0）
- Center 为空（center.tiles.length === 0）

---

### 2. 修复 Phase Transition 逻辑

**`src/azulGame.ts`** - 修改 `checkAndTransitionPhase()` 函数：

```typescript
function checkAndTransitionPhase(state: AzulState): AzulState {
  // ✅ 修复：检查回合是否结束（factories AND center 都空）
  if (isRoundEnded(state)) {
    // Check if any player has filled pattern lines
    const playersWithFilledLines = state.players.filter(p =>
      hasAnyFilledPatternLine(p.patternLines)
    );

    if (playersWithFilledLines.length === 0) {
      // No player has filled lines - skip wall-tiling phase and start new round
      return finishWallTiling({ ...state, phase: 'wall-tiling' });
    }

    // Find first player with filled lines
    let firstPlayerWithFilledLines = state.currentPlayerIndex;
    for (let i = 0; i < state.players.length; i++) {
      const checkIndex = (state.currentPlayerIndex + i) % state.players.length;
      if (hasAnyFilledPatternLine(state.players[checkIndex].patternLines)) {
        firstPlayerWithFilledLines = checkIndex;
        break;
      }
    }

    // Transition to wall-tiling phase with correct player
    return {
      ...state,
      phase: 'wall-tiling',
      currentPlayerIndex: firstPlayerWithFilledLines
    };
  }

  // ✅ 修复：回合未结束 - 继续让下一位玩家从 center 拿 tile
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return { ...state, currentPlayerIndex: nextPlayerIndex };
}
```

**关键修复**：
- **旧逻辑**：只检查 `factoriesEmpty`
- **新逻辑**：使用 `isRoundEnded()` 检查 factories **AND** center 都为空
- **结果**：factories 空但 center 非空时，继续 factory-offer 阶段

---

### 3. 添加 UI 提示

**`src/App.tsx`** - 新增 useEffect 检测 factories 空但 center 非空：

```typescript
// Check for factories empty but center not empty situation
useEffect(() => {
  if (gameState.phase === 'factory-offer' && !gameState.gameEnded) {
    const factoriesEmpty = gameState.factories.every(f => f.tiles.length === 0);
    const centerNotEmpty = gameState.center.tiles.length > 0;

    if (factoriesEmpty && centerNotEmpty && !selectedSource && !gameState.takenTiles) {
      setMessage(`Factories empty. Center still has ${gameState.center.tiles.length} tiles. Player ${gameState.currentPlayerIndex + 1} must take from Center.`);
    }
  }
}, [gameState.phase, gameState.factories, gameState.center.tiles, gameState.currentPlayerIndex, gameState.gameEnded, selectedSource, gameState.takenTiles]);
```

**效果**：
- Factories 空但 center 非空时，自动显示提示
- 提示内容：`"Factories empty. Center still has X tiles. Player Y must take from Center."`

---

## 📋 实现的目标行为

### ✅ 1. 正确的回合结束条件

**定义 roundEnded**：
- `allFactoriesEmpty === true` **AND** `centerEmpty === true`

**实现**：
```typescript
export function isRoundEnded(state): boolean {
  const allFactoriesEmpty = state.factories.every(f => f.tiles.length === 0);
  const centerEmpty = state.center.tiles.length === 0;
  return allFactoriesEmpty && centerEmpty;
}
```

**只有 roundEnded 为 true，才允许进入 wall-tiling 阶段。**

---

### ✅ 2. 取 tile 阶段的状态推进

**在 TAKE_TILES (factory-offer) 阶段**：

✅ **Factories 空但 center 还有 tile**：
- ✅ 必须继续让玩家从 center 拿 tile
- ✅ UI 提示：`"Factories empty. Center still has X tiles. Player Y must take from Center."`
- ✅ 禁止进入放墙阶段（phase 保持为 'factory-offer'）
- ✅ 不隐藏 pattern lines / 不切 wall-only 视图

✅ **玩家从 factory 拿某颜色后**：
- ✅ 该 factory 中非该颜色 tiles 全部移动到 center（保持现有逻辑）

✅ **玩家从 center 拿某颜色后**：
- ✅ Center 中该颜色 tiles 全部拿走，剩余颜色留在 center

---

### ✅ 3. "谁能高亮/聚焦"的逻辑与回合结束分离

✅ **"是否进入放墙阶段"的唯一条件**：roundEnded（factories + center 都空）

✅ **保留之前的修复**：没有 filled pattern lines 的玩家不高亮/不聚焦
- 仅在 `roundEnded==true` 且处于 PLACE_TO_WALL 阶段时生效

✅ **TAKE_TILES 阶段**：无论 factories 是否为空，都应该高亮当前 activePlayer
- 因为他必须继续从 center 拿

---

### ✅ 4. UI 行为要求

✅ **Factories 空但 center 非空**：
- ✅ Factories 区域显示 Empty（维持现状）
- ✅ Center 区域明显可点击/可选色
- ✅ 不允许出现 "Finish Round" 可点击（phase 不是 wall-tiling，按钮不显示）
- ✅ 不自动切换到 wall placement 模式

---

## 🧪 测试覆盖

### 新增测试文件：`src/azulGame.roundEnd.test.ts`（8 个测试）

**完全重写，覆盖回合结束条件测试**：

1. ✅ `factories empty but center not empty => round NOT ended, phase stays factory-offer`
2. ✅ `factories empty and center empty => round ended, phase transitions to wall-tiling`
3. ✅ `taking from center reduces center tiles and continues until empty`
4. ✅ `isRoundEnded returns false when only factories are empty`
5. ✅ `isRoundEnded returns false when only center is empty`
6. ✅ `isRoundEnded returns true when both factories and center are empty`
7. ✅ `integration: factories emptied first, then center must be emptied before wall-tiling`
8. ✅ `integration: center-only continuation after factories empty`

---

## 📊 测试结果

```bash
npm test
```

**结果**：
```
Test Suites: 6 passed, 6 total
Tests:       48 passed, 48 total
Snapshots:   0 total
Time:        5.307 s
```

**所有测试通过** ✅

---

## 🏗️ 构建验证

```bash
npm run build
```

**结果**：
```
✓ 32 modules transformed.
dist/assets/index-C4m70Tl8.js  217.20 kB │ gzip: 67.44 kB
✓ built in 651ms
```

**构建成功** ✅

---

## 📁 修改的文件

### 1. `src/azulTypes.ts`
**新增**：
- `isRoundEnded(state)` - Helper 函数，检查 factories **AND** center 都为空

```typescript
export function isRoundEnded(state: Pick<AzulState, 'factories' | 'center'>): boolean {
  const allFactoriesEmpty = state.factories.every(f => f.tiles.length === 0);
  const centerEmpty = state.center.tiles.length === 0;
  return allFactoriesEmpty && centerEmpty;
}
```

---

### 2. `src/azulGame.ts`
**修改**：
- 导入 `isRoundEnded`
- 修改 `checkAndTransitionPhase()`:
  - 使用 `isRoundEnded()` 代替只检查 `factoriesEmpty`
  - 只有 factories **AND** center 都空时才进入 wall-tiling 阶段
  - 否则继续 factory-offer 阶段（玩家必须继续从 center 拿 tile）

**关键代码位置**：`src/azulGame.ts:210-244`

```typescript
function checkAndTransitionPhase(state: AzulState): AzulState {
  // Check if round has ended (all factories AND center are empty)
  if (isRoundEnded(state)) {
    // ... (进入 wall-tiling 阶段的逻辑)
  }

  // Round not ended - move to next player
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return { ...state, currentPlayerIndex: nextPlayerIndex };
}
```

---

### 3. `src/App.tsx`
**修改**：
- 导入 `isRoundEnded`
- 新增 useEffect 检测 factories 空但 center 非空的情况
- 自动显示提示信息引导玩家从 center 拿 tile

**关键代码位置**：`src/App.tsx:40-50`

```typescript
// Check for factories empty but center not empty situation
useEffect(() => {
  if (gameState.phase === 'factory-offer' && !gameState.gameEnded) {
    const factoriesEmpty = gameState.factories.every(f => f.tiles.length === 0);
    const centerNotEmpty = gameState.center.tiles.length > 0;

    if (factoriesEmpty && centerNotEmpty && !selectedSource && !gameState.takenTiles) {
      setMessage(`Factories empty. Center still has ${gameState.center.tiles.length} tiles. Player ${gameState.currentPlayerIndex + 1} must take from Center.`);
    }
  }
}, [gameState.phase, gameState.factories, gameState.center.tiles, ...]);
```

---

### 4. `src/azulGame.roundEnd.test.ts` ⭐
**完全重写**：8 个测试，全部通过

---

## 🎯 关键逻辑点总结

### 1. 回合结束判定
```typescript
// 旧逻辑（错误）：
const factoriesEmpty = state.factories.every(f => f.tiles.length === 0);
if (factoriesEmpty) { /* 进入 wall-tiling */ }

// 新逻辑（正确）：
if (isRoundEnded(state)) { /* 进入 wall-tiling */ }
// isRoundEnded 检查 factories AND center 都为空
```

### 2. Phase Transition 时机
```typescript
// 只有满足以下条件才进入 wall-tiling：
1. factories 全部为空
2. center 也为空
3. 至少有一个玩家有已填满的 pattern line
```

### 3. UI 提示逻辑
```typescript
// Factories 空 + Center 非空 → 显示提示
if (factoriesEmpty && centerNotEmpty) {
  setMessage("Factories empty. Center still has X tiles. Player Y must take from Center.");
}
```

---

## 🎮 游戏流程示例

### 场景：Factories 空但 Center 非空

**步骤**：
1. Player 1 从 Factory 1 拿 fire tiles
   - 非 fire 的 tiles 移动到 center
2. Player 2 从 Factory 2 拿 water tiles
   - 非 water 的 tiles 移动到 center
3. ...（继续拿直到所有 factories 空）
4. **所有 factories 为空**，但 **center 还有 tiles**
   - ✅ UI 提示：`"Factories empty. Center still has 5 tiles. Player 1 must take from Center."`
   - ✅ Phase 保持为 'factory-offer'
   - ✅ Player 1 必须从 center 拿 tile
5. Player 1 从 center 拿 grass tiles
6. Player 2 从 center 拿 electric tiles
7. **Center 也为空了**
   - ✅ 回合结束条件满足：`isRoundEnded(state) === true`
   - ✅ Phase 转换为 'wall-tiling'
   - ✅ 进入放墙阶段

---

## 📈 测试统计

| 测试套件 | 测试数 | 状态 |
|---------|--------|------|
| azulGame.test.ts | 14 | ✅ |
| azulGame.walltiling.test.ts | 15 | ✅ |
| azulGame.ui-flow.test.ts | 3 | ✅ |
| **azulGame.roundEnd.test.ts** | **8** | **✅** |
| azulGame.highlightFix.test.ts | 6 | ✅ |
| gameLogic.test.ts | 2 | ✅ |
| **总计** | **48** | **✅** |

---

## 🎉 总结

**所有要求 100% 实现**：

✅ **核心修复**：
- 回合结束条件：factories **AND** center 都为空
- Factories 空但 center 非空时，继续 factory-offer 阶段
- 玩家必须继续从 center 拿 tile，直到 center 也空

✅ **实现细节**：
- 新增 Helper 函数：`isRoundEnded()`
- 修改 Phase Transition 逻辑：使用 `isRoundEnded()` 判断
- UI 提示：自动提示玩家从 center 拿 tile

✅ **测试覆盖**：
- 8 个测试全部通过
- 总计 48 个测试全部通过

✅ **UI 行为**：
- Factories 空但 center 非空时，不进入放墙阶段
- 显示明确提示引导玩家从 center 拿 tile
- Center 区域保持可点击状态

---

## 🔗 相关文件

- **实现文档**：`ROUND_END_FIX_IMPLEMENTATION.md`（当前文件）
- **测试文件**：`src/azulGame.roundEnd.test.ts`
- **核心逻辑**：
  - `src/azulTypes.ts:182-187` - `isRoundEnded()` helper
  - `src/azulGame.ts:210-244` - `checkAndTransitionPhase()` 修复
  - `src/App.tsx:40-50` - UI 提示 useEffect

---

**修复完成！游戏现在正确实现 Azul 回合结束规则：factories AND center 都为空才算回合结束。**
