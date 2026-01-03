# 🎮 Wall-Tiling 阶段轮转逻辑完整实现

## ✅ 实现完成

**开发服务器**: http://localhost:5174/
**测试结果**: 34/34 PASS ✅
**构建结果**: SUCCESS (441ms) ✅

---

## 📋 核心改动

### 目标：完整的 Wall-Tiling 阶段交互 + 自动轮转

**实现内容**:
1. ✅ Factories 空时自动进入 WALL_TILING 阶段（center 可能还有 tile）
2. ✅ 只能操作当前玩家的已满 pattern line
3. ✅ 剩余 tiles 回到 center（不是 lid）
4. ✅ 玩家间自动切换 + 自动 focus
5. ✅ 完成后根据 center 状态决定下一步：
   - center 有 tile → 回 TAKE 阶段（只能从 center 取）
   - center 无 tile → refill factories 开新回合

---

## 🔧 修改的文件

### 1️⃣ `src/azulGame.ts` - 游戏引擎

#### A. 修改 `checkAndTransitionPhase` 函数（第 206-218 行）

**BEFORE**:
```typescript
// Check if all factories and center are empty
const allEmpty =
  state.factories.every((f) => f.tiles.length === 0) &&
  state.center.tiles.length === 0;

if (allEmpty) {
  return { ...state, phase: 'wall-tiling' };
}
```

**AFTER**:
```typescript
// Check if all factories are empty (center may still have tiles)
const factoriesEmpty = state.factories.every((f) => f.tiles.length === 0);

if (factoriesEmpty) {
  // Transition to wall-tiling phase
  return { ...state, phase: 'wall-tiling' };
}
```

**改进**: Factories 空即进入 wall-tiling，无需等 center 也空

---

#### B. 修改 `placePatternLineToWall` 函数（第 371-410 行）

**核心改动 1: 剩余 tiles 回 center**
```typescript
// BEFORE:
// Move remaining tiles to lid (discard)
newState.lid.push(...line.tiles.slice(0, -1));

// AFTER:
// Move remaining tiles back to center (not to lid)
newState.center.tiles.push(...line.tiles.slice(0, -1));
```

**核心改动 2: 自动切换到下一个有满行的玩家**
```typescript
// Check if current player still has full lines to process
const currentPlayerFullLines = player.patternLines.filter(
  (l) => l.tiles.length === l.capacity
);

// If no more full lines, move to next player with full lines
if (currentPlayerFullLines.length === 0) {
  // Find next player with full lines
  let nextPlayerIndex = (playerIndex + 1) % newState.players.length;
  let checkedPlayers = 0;

  while (checkedPlayers < newState.players.length) {
    const nextPlayer = newState.players[nextPlayerIndex];
    const hasFullLines = nextPlayer.patternLines.some(
      (l) => l.tiles.length === l.capacity
    );

    if (hasFullLines) {
      newState.currentPlayerIndex = nextPlayerIndex;
      break;
    }

    nextPlayerIndex = (nextPlayerIndex + 1) % newState.players.length;
    checkedPlayers++;
  }

  // If no player has full lines, stay on current player
  if (checkedPlayers === newState.players.length) {
    newState.currentPlayerIndex = playerIndex;
  }
}
```

**工作原理**:
1. 当前玩家放置一个 tile 后，检查是否还有满行
2. 如果没有满行，循环查找下一个有满行的玩家
3. 自动切换 `currentPlayerIndex`
4. 触发 UI 的 `useEffect` 自动 scroll

---

#### C. 修改 `finishWallTiling` 函数（第 446-471 行）

**核心改动: 根据 center 状态决定下一步**
```typescript
// Check if center still has tiles
if (newState.center.tiles.length > 0) {
  // Center has tiles - return to factory-offer phase to continue taking from center
  newState.phase = 'factory-offer';
  // Current player is whoever is starting player
  const startingPlayerIndex = newState.players.findIndex((p) => p.isStartingPlayer);
  newState.currentPlayerIndex = startingPlayerIndex;
  return newState;
}

// Center is empty - prepare next round
newState = refillFactories(newState);
newState.phase = 'factory-offer';
newState.round += 1;
// ... reset center and set starting player
```

**两种路径**:
- **Path 1 (center 有 tile)**: 回到 factory-offer，但 factories 为空，只能从 center 取
- **Path 2 (center 空)**: Refill factories，round + 1，开启新回合

---

### 2️⃣ `src/App.tsx` - UI 组件

#### A. 修改 `handlePatternLineClick` 函数（第 84-104 行）

**新增: 只允许当前玩家点击**
```typescript
if (gameState.phase === 'wall-tiling') {
  // Only allow current player to select their lines
  if (playerIdx !== gameState.currentPlayerIndex) {
    setMessage(`It's Player ${gameState.currentPlayerIndex + 1}'s turn to place tiles on wall.`);
    return;
  }

  const player = gameState.players[playerIdx];
  const line = player.patternLines[lineIndex];

  if (line.tiles.length !== line.capacity) {
    setMessage('Pattern line is not complete. Select a completed line.');
    return;
  }

  setWalltilingSelectedLine({ playerIdx, lineIdx: lineIndex });
  setMessage(`Line L${lineIndex} selected. Click any valid (highlighted) wall position to place the tile.`);
  return;
}
```

**效果**: 非当前玩家点击满行会提示"不是你的回合"

---

#### B. 修改 `handleWallTileClick` 函数（第 171-205 行）

**新增: 检测玩家切换并提示**
```typescript
try {
  const oldPlayerIndex = gameState.currentPlayerIndex;
  const newState = placePatternLineToWall(
    gameState,
    playerIndex,
    walltiling_selectedLine.lineIdx,
    row,
    col
  );
  setGameState(newState);
  setWalltilingSelectedLine(null);

  // Check if player changed
  const playerChanged = newState.currentPlayerIndex !== oldPlayerIndex;

  // Check if there are more completed lines to process
  const hasMoreCompletedLines = newState.players.some(p =>
    p.patternLines.some(line => line.tiles.length === line.capacity)
  );

  if (hasMoreCompletedLines) {
    if (playerChanged) {
      setMessage(`Tile placed! Player ${newState.currentPlayerIndex + 1}'s turn to place tiles on wall.`);
    } else {
      setMessage('Tile placed! Select another completed pattern line to continue wall-tiling.');
    }
  } else {
    setMessage('All completed lines processed. Click "Finish Round" to apply floor penalties and start next round.');
  }
} catch (error) {
  // ...
}
```

**效果**:
- 玩家切换时显示"Player X's turn"
- 自动触发 scroll（通过 useEffect 监听 currentPlayerIndex）

---

#### C. 修改 `handleFinishRound` 函数（第 151-168 行）

**新增: 区分 center 有无 tile 的提示**
```typescript
try {
  const oldRound = gameState.round;
  const newState = finishWallTiling(gameState);
  setGameState(newState);
  setWalltilingSelectedLine(null);

  // Check if center has tiles (continuing same round) or starting new round
  if (newState.round === oldRound) {
    setMessage(`Floor penalties applied. Center still has tiles! Player ${newState.currentPlayerIndex + 1}'s turn to take from center.`);
  } else {
    setMessage(`Round ${newState.round} started! Player ${newState.currentPlayerIndex + 1}'s turn.`);
  }
} catch (error) {
  // ...
}
```

**效果**:
- 回合未变 → "Center still has tiles!"
- 回合 +1 → "Round X started!"

---

#### D. 修改 Pattern Lines 渲染逻辑（第 341-368 行）

**新增: 只有当前玩家的满行可点击**
```typescript
const isWallTilingPhase = gameState.phase === 'wall-tiling';
const isCompleted = line.tiles.length === line.capacity;
const isClickable =
  (idx === gameState.currentPlayerIndex && gameState.takenTiles) ||
  (isWallTilingPhase && isCompleted && idx === gameState.currentPlayerIndex); // ← 关键
const isSelected = walltiling_selectedLine?.playerIdx === idx && walltiling_selectedLine?.lineIdx === lineIdx;
```

**CSS 改动**:
```typescript
border: isSelected
  ? '2px solid #339af0'
  : (isWallTilingPhase && isCompleted && idx === gameState.currentPlayerIndex)
  ? '2px solid #40c057'  // ← 绿色边框（可点击）
  : (idx === gameState.currentPlayerIndex && gameState.takenTiles)
  ? '2px dashed #339af0'
  : '1px solid #dee2e6',
opacity: isClickable ? 1 : 0.5,  // ← 不可点击半透明
```

**效果**:
- 当前玩家的满行: 绿色边框 + opacity: 1
- 其他玩家的满行: 灰色边框 + opacity: 0.5（置灰）

---

### 3️⃣ `src/azulGame.walltiling.test.ts` - 测试更新

#### A. 修改测试：允许 center 有 tile（第 56-61 行）
```typescript
// Should have entered wall-tiling phase
expect(state.phase).toBe('wall-tiling');
expect(state.factories.every(f => f.tiles.length === 0)).toBe(true);
// NOTE: center may still have tiles (they go to center during placeToPatternLine overflow)
// We just need to verify phase transition happened
```

#### B. 修改测试：剩余 tile 去 center（第 91-93 行）
```typescript
// BEFORE:
// expect(state.lid.length).toBe(1);

// AFTER:
// Check: 1 tile went to center (remaining tiles)
expect(state.center.tiles.length).toBe(1);
expect(state.center.tiles[0].color).toBe('fire');
```

---

## 📊 测试覆盖

**测试结果**: ✅ **34/34 PASS**

**测试套件**:
- `gameLogic.test.ts`: 8 passed
- `azulGame.test.ts`: 9 passed
- `azulGame.ui-flow.test.ts`: 2 passed
- `azulGame.walltiling.test.ts`: 15 passed

**关键测试用例**:
1. ✅ Factories 空时自动进入 wall-tiling（即使 center 有 tile）
2. ✅ 放置 1 个 tile 到墙，剩余回 center
3. ✅ Pattern line 正确清空
4. ✅ 玩家自动切换（通过 placePatternLineToWall）
5. ✅ finishWallTiling 根据 center 状态决定下一步

---

## 🎮 完整交互流程

### 场景 1: Factories 空 → Wall-Tiling

```
1. 玩家轮流从 factories 拿 tiles
   ↓
2. 最后一个 factory 清空
   ↓
3. placeToPatternLine 自动检测 → 进入 wall-tiling
   ↓
4. 消息: "Round End: All factories empty! Enter Wall Tiling phase."
   ↓
5. 只有当前玩家（假设 Player 2）的满行显示绿色边框
   - Player 2 L0 (1/1): 绿色边框 + 可点击
   - Player 2 L1 (1/2): 灰色边框 + 置灰（未满）
   - Player 1 满行: 灰色边框 + 置灰（不是当前玩家）
```

---

### 场景 2: Player 2 贴墙

```
1. Player 2 点击 L0 (1/1) ← 绿色边框
   ↓
2. L0 高亮（蓝色背景）
   ↓
3. Wall 所有合法格子显示绿色边框 + 箭头 ↓
   ↓
4. 消息: "Line L0 selected. Click any valid wall position."
   ↓
5. Player 2 点击 Wall [2,2] ← 合法格子
   ↓
6. **执行**:
   - 1 个 tile 放到 Wall [2,2]（实心颜色）
   - L0 清空（0/1）
   - 剩余 0 个 tile（L0 容量 1，只有 1 个 tile）
   - 分数更新（+1 或根据 adjacency）
   ↓
7. Player 2 没有其他满行
   ↓
8. **自动切换到 Player 1**
   - currentPlayerIndex 变为 0
   - 页面自动 scroll 到 Player 1 区域 ✨
   ↓
9. 消息: "Tile placed! Player 1's turn to place tiles on wall."
```

---

### 场景 3: Player 1 贴墙

```
1. 页面已 scroll 到 Player 1
   ↓
2. Player 1 的满行显示绿色边框
   ↓
3. Player 1 点击满行 → 选择墙格子 → 放置
   ↓
4. 检查是否还有满行
   - 如果有：重复 Player 1 操作
   - 如果没有：检查 Player 2 是否还有满行
```

---

### 场景 4: 所有满行处理完 → Finish Round

```
1. 两位玩家都没有满行了
   ↓
2. 消息: "All completed lines processed. Click 'Finish Round'..."
   ↓
3. 玩家点击绿色 "Finish Round" 按钮
   ↓
4. **finishWallTiling 执行**:
   - 应用 floor penalties（-1,-1,-2,-2,-2,-3,-3）
   - Floor tiles 清空
   - 检查 center 是否有 tile
   ↓
5a. **如果 center 有 tile**:
   - phase 保持 'factory-offer'
   - round 不变
   - currentPlayerIndex = starting player
   - 消息: "Center still has tiles! Player X's turn to take from center."
   - Factories 显示 Empty，只能从 center 取
   ↓
5b. **如果 center 无 tile**:
   - Refill factories（从 bag，bag 空则用 lid）
   - round += 1
   - phase = 'factory-offer'
   - Reset center（加回 ⭐ marker）
   - 消息: "Round 2 started! Player X's turn."
```

---

### 场景 5: Center 有 tile → 继续 TAKE

```
1. finishWallTiling 后，center 还有 3 个 tiles
   ↓
2. phase = 'factory-offer'
   ↓
3. Factories 都显示 "Empty"
   ↓
4. 玩家只能点击 Center
   ↓
5. Center 显示 3 个 tiles + ⭐（如果还在）
   ↓
6. 玩家点击 Center → 选择颜色 → 拿走 tiles
   ↓
7. 继续轮流，直到 center 空
   ↓
8. center 空了 → 进入 wall-tiling（如果有满行）
   ↓
9. 再次 finishWallTiling → 这次 center 空 → refill factories
```

---

## 🎨 UI 视觉效果

### Wall-Tiling 阶段 - Player 2 回合

```
┌─────────────────────────────────────┐
│ Player 1 (灰色边框，非当前)          │
├─────────────────────────────────────┤
│ Pattern Lines:                      │
│ ┌──────────────┐                    │
│ │ L0 [F] (1/1) │ ← 置灰（0.5 opacity）│
│ │ L1 [ ][ ](0/2)│                    │
│ └──────────────┘                    │
└─────────────────────────────────────┘

┌═════════════════════════════════════┐ ← 蓝色粗边框（当前）
│ Player 2 ⭐                         │
├─────────────────────────────────────┤
│ Pattern Lines:                      │
│ ┌══════════════┐ ← 绿色边框（可点击）│
│ ║ L0 [F] (1/1) ║                    │
│ └══════════════┘                    │
│ ┌──────────────┐ ← 灰色边框（未满）  │
│ │ L1 [W] (1/2) │                    │
│ └──────────────┘                    │
│                                     │
│ Wall:                               │
│ ┌──┬══┬──┬──┬──┐                   │
│ │  ║↓║  │  │  │ ← 绿色边框 + 箭头  │
│ ├──╬══╬──┼──┼──┤                   │
│ │  ║  ║  │  │  │                   │
│ └──┴──┴──┴──┴──┘                   │
└─────────────────────────────────────┘
```

---

## 📐 关键状态字段

### AzulState
```typescript
{
  phase: 'factory-offer' | 'wall-tiling' | 'game-end',
  currentPlayerIndex: number,  // 自动切换
  round: number,               // finishWallTiling 可能 +1
  factories: Factory[],        // 空时触发 wall-tiling
  center: { tiles: Tile[], hasStartingPlayerMarker: boolean },  // 剩余 tiles 回这里
  players: PlayerBoard[],
}
```

### Pattern Line
```typescript
{
  capacity: number,  // 1, 2, 3, 4, 5
  tiles: Tile[],     // tiles.length === capacity 时为满行
  color: TileColor | null,
}
```

---

## ✅ 验收步骤

### 步骤 1: 进入 Wall-Tiling 阶段

1. 访问 http://localhost:5174/
2. 轮流拿 tiles 直到 factories 全空（center 可能还有 tile）
3. **预期**:
   - ✅ 自动进入 wall-tiling 阶段（无需点击按钮）
   - ✅ 消息: "Round End: All factories empty! Enter Wall Tiling phase..."
   - ✅ 当前玩家的满行显示绿色边框
   - ✅ 非当前玩家的满行置灰（opacity: 0.5）

---

### 步骤 2: 当前玩家贴墙

1. 点击当前玩家的满行（绿色边框）
2. **预期**:
   - ✅ 该行高亮（蓝色背景）
   - ✅ Wall 所有合法格子显示绿色边框 + 箭头 ↓
   - ✅ 消息: "Line LX selected. Click any valid wall position."
3. 点击合法格子
4. **预期**:
   - ✅ Tile 立即出现在 Wall 上（实心颜色）
   - ✅ Pattern Line 清空（tiles 消失）
   - ✅ 剩余 tiles 出现在 Center（如果有）
   - ✅ 分数立即更新

---

### 步骤 3: 自动切换到下一玩家

1. 当前玩家处理完所有满行
2. **预期**:
   - ✅ 自动切换 currentPlayerIndex
   - ✅ 页面自动 scroll 到下一玩家区域
   - ✅ 消息: "Player X's turn to place tiles on wall."
   - ✅ 新当前玩家的满行显示绿色边框

---

### 步骤 4: 非当前玩家尝试点击

1. 点击非当前玩家的满行
2. **预期**:
   - ✅ 无响应（不进入选择态）
   - ✅ 消息: "It's Player X's turn to place tiles on wall."

---

### 步骤 5: Finish Round

1. 所有玩家处理完满行后
2. 点击绿色 "Finish Round" 按钮
3. **预期**:
   - ✅ Floor tiles 清空
   - ✅ 分数扣除（floor penalties）
   - ✅ 检查 center 状态：
     - **如果 center 有 tile**:
       - ✅ 消息: "Center still has tiles! Player X's turn to take from center."
       - ✅ Factories 显示 Empty
       - ✅ 只能从 Center 取
       - ✅ round 不变
     - **如果 center 无 tile**:
       - ✅ 消息: "Round 2 started! Player X's turn."
       - ✅ Factories 重新填满
       - ✅ Center 重置（⭐ marker 回来）
       - ✅ round += 1

---

### 步骤 6: Center 有 tile 继续 TAKE

1. finishWallTiling 后 center 还有 tile
2. **预期**:
   - ✅ phase = 'factory-offer'
   - ✅ 可以点击 Center
   - ✅ 不能点击 Factories（显示 Empty）
3. 从 Center 拿 tiles → 放 Pattern Line
4. **预期**:
   - ✅ 正常轮流
   - ✅ Center 清空后再次进入 wall-tiling
5. 再次 finishWallTiling（center 这次为空）
6. **预期**:
   - ✅ Refill factories
   - ✅ Round 2 开始

---

## 🚀 交付总结

**状态**: ✅ **COMPLETE**

**修改文件**:
1. ✅ `src/azulGame.ts` - 引擎逻辑（3 个函数修改）
2. ✅ `src/App.tsx` - UI 交互（4 个函数修改 + 1 处渲染逻辑）
3. ✅ `src/azulGame.walltiling.test.ts` - 测试更新（2 处）

**核心功能**:
1. ✅ Factories 空 → 自动进入 wall-tiling
2. ✅ 只有当前玩家的满行可操作
3. ✅ 剩余 tiles 回 center（不是 lid）
4. ✅ 玩家间自动切换 + 自动 scroll
5. ✅ 根据 center 状态决定下一步：
   - center 有 tile → 回 TAKE（只能从 center）
   - center 无 tile → refill + 新回合

**测试结果**:
- ✅ 34/34 tests PASS
- ✅ Build SUCCESS

**立即验收**:
刷新 http://localhost:5174/，按照上述步骤验收所有交互！

---

**🎊 完整的 Wall-Tiling 轮转逻辑实现完成！**
