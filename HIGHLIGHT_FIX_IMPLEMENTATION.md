# Factories 清空后玩家高亮/聚焦逻辑修复 - 完整实现报告

## ✅ 实现状态：100% 完成

所有要求的功能已完整实现并通过测试（49/49 PASS）。

---

## 🐛 问题描述

**原问题**：
- 当 factories 都空（进入 wall placement 阶段）时，UI 会高亮某个玩家区域并聚焦到该玩家
- 但该玩家可能没有任何已填满（completed/filled）的 pattern line
- 因此他没有任何 tile 可放到 wall，高亮/聚焦属于错误引导

---

## ✅ 实现的修复

### 1. 新增 Helper 函数

**`src/azulTypes.ts`** - 新增 `hasAnyFilledPatternLine()`：

```typescript
// Check if a player has any filled (completed) pattern lines
export function hasAnyFilledPatternLine(patternLines: PatternLine[]): boolean {
  return patternLines.some(line => line.tiles.length === line.capacity && line.capacity > 0);
}
```

**作用**：判断玩家是否有至少 1 条已填满的 pattern line。

---

### 2. 修复 Phase Transition 逻辑

**`src/azulGame.ts`** - 修改 `checkAndTransitionPhase()` 函数：

```typescript
function checkAndTransitionPhase(state: AzulState): AzulState {
  const factoriesEmpty = state.factories.every((f) => f.tiles.length === 0);

  if (factoriesEmpty) {
    // Check if any player has filled pattern lines
    const playersWithFilledLines = state.players.filter(p =>
      hasAnyFilledPatternLine(p.patternLines)
    );

    if (playersWithFilledLines.length === 0) {
      // ✅ 修复：两人都无可放 → 自动跳过 wall-tiling 阶段并开始新一轮
      return finishWallTiling({ ...state, phase: 'wall-tiling' });
    }

    // ✅ 修复：找到第一个有已填满 pattern line 的玩家
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

  // Move to next player
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return { ...state, currentPlayerIndex: nextPlayerIndex };
}
```

**关键修复**：
1. **检查是否有玩家有已填满的 pattern line**
2. **若都没有** → 自动调用 `finishWallTiling()` 跳过 wall-tiling 阶段
3. **若有** → 找到第一个有已填满 pattern line 的玩家，设置为 `currentPlayerIndex`

---

### 3. 修复 UI 高亮逻辑

**`src/App.tsx`** - 修改玩家区域高亮条件：

```typescript
{gameState.players.map((player, idx) => {
  // ✅ 修复：只有满足条件时才高亮
  const shouldHighlight = idx === gameState.currentPlayerIndex &&
    (gameState.phase !== 'wall-tiling' || hasAnyFilledPatternLine(player.patternLines));

  return (
    <div
      style={{
        border: shouldHighlight ? '3px solid #339af0' : '1px solid #dee2e6',
        backgroundColor: shouldHighlight ? '#f8f9fa' : 'white',
        // ...
      }}
    >
      {/* ... */}
    </div>
  );
})}
```

**高亮条件**：
- **Factory-Offer Phase**：当前玩家 → 高亮
- **Wall-Tiling Phase**：当前玩家 **且** 有已填满的 pattern line → 高亮
- **其他情况**：不高亮

---

## 📋 实现的目标行为

### A) Factories 清空后进入 placement 阶段时

✅ **1. 仅当玩家有已填满的 pattern line 时才高亮**
- 使用 `hasAnyFilledPatternLine()` 检查
- UI 高亮逻辑：`shouldHighlight = currentPlayer && (notWallTiling || hasFilledLines)`

✅ **2. 玩家没有已填满的 pattern line 时**
- ❌ 不高亮该玩家区域
- ❌ 不自动 scroll/focus 到该玩家
- ❌ 不显示"轮到你放墙"的提示

✅ **3. 两位玩家都没有已填满的 pattern line 时**
- 自动调用 `finishWallTiling()`
- 应用 floor penalties
- 立即开始新一轮发牌（Round +1）
- **不需要用户点击 Finish Round**

### B) 放墙阶段的推进顺序

✅ **4. Factories 全空后，系统按顺序处理**
- 从当前玩家开始，按顺序查找有已填满 pattern line 的玩家
- 第一个找到的玩家成为 `currentPlayerIndex`
- 该玩家被 focus/highlight 并允许放墙
- 若都没有 → 自动结束放墙阶段并开始新一轮

---

## 🧪 测试覆盖

### 新增测试文件：`src/azulGame.highlightFix.test.ts`（6 个测试）

1. ✅ **`factories empty + p1 no filled lines + p2 has filled lines`**
   - 验证：Player 2 有已填满 line，Player 1 没有
   - 结果：Player 2 成为 active player

2. ✅ **`factories empty + both no filled lines`**
   - 验证：两个玩家都没有已填满 line
   - 结果：应该跳过 wall-tiling 阶段

3. ✅ **`hasAnyFilledPatternLine returns true when at least one line is filled`**
   - 验证：Helper 函数正确识别已填满的 line

4. ✅ **`hasAnyFilledPatternLine returns false when lines are partially filled`**
   - 验证：Helper 函数正确识别未填满的 line

5. ✅ **`integration: factories empty triggers correct player selection`**
   - 完整流程测试：factories 清空后，正确选择有已填满 line 的玩家

6. ✅ **`integration: factories empty + no filled lines => auto start new round`**
   - 完整流程测试：两人都没有已填满 line 时，自动开始新一轮

---

## 📊 测试结果

```bash
npm test
```

**结果**：
```
Test Suites: 6 passed, 6 total
Tests:       49 passed, 49 total
Snapshots:   0 total
Time:        2.746 s
```

**所有测试通过** ✅

---

## 📁 修改的文件

### 1. `src/azulTypes.ts`
**新增**：
- `hasAnyFilledPatternLine(patternLines)` - Helper 函数，检查是否有已填满的 pattern line

### 2. `src/azulGame.ts`
**修改**：
- 导入 `hasAnyFilledPatternLine`
- 修改 `checkAndTransitionPhase()`:
  - 检查玩家是否有已填满的 pattern line
  - 若都没有 → 自动调用 `finishWallTiling()` 跳过 wall-tiling 阶段
  - 若有 → 找到第一个有已填满 pattern line 的玩家

### 3. `src/App.tsx`
**修改**：
- 导入 `hasAnyFilledPatternLine`
- 修改玩家区域高亮逻辑：
  - 只有在 wall-tiling 阶段且玩家有已填满 pattern line 时才高亮
  - 其他阶段按原逻辑高亮当前玩家

### 4. `src/azulGame.highlightFix.test.ts` ⭐
**新增**：6 个测试，全部通过

---

## 🎯 验收标准

### ✅ Factories 空后：

1. **若 player 没有已填满 pattern line**：
   - ❌ 他的区域不高亮
   - ❌ 不聚焦到他
   - ✅ 实现方式：`shouldHighlight` 条件检查

2. **只有存在可放 wall 的玩家才高亮/聚焦**：
   - ✅ 实现方式：`checkAndTransitionPhase()` 找到第一个有已填满 line 的玩家

3. **若两人都无可放**：
   - ✅ 系统自动进入下一轮发牌
   - ✅ 不需要用户点击 Finish Round
   - ✅ 实现方式：`finishWallTiling()` 自动调用

---

## 🔍 关键逻辑点

### 1. Helper 函数：检查是否有已填满的 pattern line
```typescript
export function hasAnyFilledPatternLine(patternLines: PatternLine[]): boolean {
  return patternLines.some(line =>
    line.tiles.length === line.capacity && line.capacity > 0
  );
}
```

### 2. Phase Transition：智能玩家选择
```typescript
if (factoriesEmpty) {
  // 检查是否有玩家有已填满的 pattern line
  const playersWithFilledLines = state.players.filter(p =>
    hasAnyFilledPatternLine(p.patternLines)
  );

  if (playersWithFilledLines.length === 0) {
    // 两人都无可放 → 自动开始新一轮
    return finishWallTiling({ ...state, phase: 'wall-tiling' });
  }

  // 找到第一个有已填满 pattern line 的玩家
  let firstPlayerWithFilledLines = state.currentPlayerIndex;
  for (let i = 0; i < state.players.length; i++) {
    const checkIndex = (state.currentPlayerIndex + i) % state.players.length;
    if (hasAnyFilledPatternLine(state.players[checkIndex].patternLines)) {
      firstPlayerWithFilledLines = checkIndex;
      break;
    }
  }

  return {
    ...state,
    phase: 'wall-tiling',
    currentPlayerIndex: firstPlayerWithFilledLines
  };
}
```

### 3. UI 高亮：条件判断
```typescript
const shouldHighlight = idx === gameState.currentPlayerIndex &&
  (gameState.phase !== 'wall-tiling' || hasAnyFilledPatternLine(player.patternLines));
```

---

## 🚀 构建验证

```bash
npm run build
```

**结果**：
```
✓ 32 modules transformed.
dist/index.html                  0.32 kB │ gzip:  0.25 kB
dist/assets/index-C68UIAn3.js  216.75 kB │ gzip: 67.34 kB
✓ built in 506ms
```

**构建成功** ✅

---

## 📈 测试统计

| 测试套件 | 测试数 | 状态 |
|---------|--------|------|
| azulGame.test.ts | 14 | ✅ |
| azulGame.walltiling.test.ts | 15 | ✅ |
| azulGame.ui-flow.test.ts | 3 | ✅ |
| azulGame.roundEnd.test.ts | 9 | ✅ |
| **azulGame.highlightFix.test.ts** | **6** | **✅** |
| gameLogic.test.ts | 2 | ✅ |
| **总计** | **49** | **✅** |

---

## 🎉 总结

**所有要求 100% 实现**：

✅ **问题修复**：
- Factories 清空后不再错误高亮没有已填满 pattern line 的玩家
- 只有有已填满 pattern line 的玩家才被高亮/聚焦
- 两人都没有已填满 line 时，自动跳过 wall-tiling 阶段并开始新一轮

✅ **新增功能**：
- Helper 函数：`hasAnyFilledPatternLine()`
- 智能玩家选择：自动找到第一个有已填满 pattern line 的玩家
- 自动跳过：两人都无可放时，自动进入下一轮

✅ **测试覆盖**：
- 6 个新测试全部通过
- 总计 49 个测试全部通过

✅ **构建成功**：
- 无编译错误
- 代码已优化

---

## 🔗 相关文件

- **实现文档**：`HIGHLIGHT_FIX_IMPLEMENTATION.md`（当前文件）
- **测试文件**：`src/azulGame.highlightFix.test.ts`
- **核心逻辑**：
  - `src/azulTypes.ts` - Helper 函数
  - `src/azulGame.ts` - Phase transition 修复
  - `src/App.tsx` - UI 高亮逻辑修复

---

**修复完成！游戏现在正确处理 factories 清空后的玩家高亮/聚焦逻辑。**
