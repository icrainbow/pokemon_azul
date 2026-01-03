# 🎮 Wall 自由放置规则实现报告

## ✅ 实现完成

**开发服务器**: http://localhost:5174/
**测试结果**: 34/34 PASS ✅
**构建结果**: SUCCESS (437ms) ✅

---

## 📋 核心改动

### 目标：Wall 自由放置 + 同色相邻禁止

**移除**:
- ❌ 预设 Wall Pattern（每行固定颜色位置）
- ❌ 每行只能放特定颜色的限制
- ❌ 自动 wall-tiling 函数 (wallTilingPhase)

**新增**:
- ✅ Wall 为完全空白的 5x5 网格
- ✅ 玩家可自由选择放置位置
- ✅ 同属性 tile 不能相邻（上下左右四邻）
- ✅ 合法格子高亮 + 非法格子置灰
- ✅ 点击非法格子显示错误提示

---

## 🔧 修改的文件

### 1️⃣ `src/azulTypes.ts` - 核心规则函数

#### A. 移除旧函数
```typescript
// REMOVED:
// - WALL_PATTERN (预设颜色布局)
// - getWallColumn (获取固定列位置)
// - canPlaceColorInRow (检查行是否已有该颜色)
```

#### B. 新增 `canPlaceOnWall` 函数（第 72-99 行）
```typescript
// Check if a tile can be placed at a specific wall position
// Rules: Position must be empty AND no adjacent tiles (up/down/left/right) have the same color
export function canPlaceOnWall(wall: Wall, row: number, col: number, color: TileColor): boolean {
  // Check if position is empty
  if (wall.grid[row][col] !== null) {
    return false;
  }

  // Check adjacent positions (up, down, left, right)
  const adjacentPositions = [
    [row - 1, col], // up
    [row + 1, col], // down
    [row, col - 1], // left
    [row, col + 1], // right
  ];

  for (const [adjRow, adjCol] of adjacentPositions) {
    // Check bounds
    if (adjRow >= 0 && adjRow < 5 && adjCol >= 0 && adjCol < 5) {
      const adjacentTile = wall.grid[adjRow][adjCol];
      if (adjacentTile && adjacentTile.color === color) {
        return false; // Same color adjacent - not allowed
      }
    }
  }

  return true;
}
```

**功能**:
- 检查位置是否为空
- 检查上下左右四个相邻位置
- 如果任何相邻位置有相同颜色，返回 false
- 边界检查（0-4 范围）

---

### 2️⃣ `src/azulGame.ts` - 游戏逻辑引擎

#### A. 更新 Import（第 12-15 行）
```typescript
import {
  FLOOR_PENALTIES,
  canPlaceOnWall,  // ← 新增
} from './azulTypes';
// 移除: WALL_PATTERN, getWallColumn, canPlaceColorInRow
```

#### B. 修改 `placeToPatternLine` 函数（第 180-186 行）
```typescript
// REMOVED: Check if color can be placed in this row
// if (!canPlaceColorInRow(player.wall, patternLineIndex, color)) {
//   throw new Error('This color is already on the wall in this row');
// }

// 现在任何颜色都可以放到任何 pattern line
```

**理由**: 移除每行固定颜色的限制，玩家可以在任何 pattern line 放置任何颜色

#### C. 修改 `placePatternLineToWall` 函数（第 439-442 行）
```typescript
// BEFORE:
// - Check wallRow === lineIndex (墙行必须等于 pattern line 行)
// - Check wallCol === getWallColumn(row, color) (固定列位置)

// AFTER:
// Check if wall position is valid (empty + no same-color adjacent)
if (!canPlaceOnWall(player.wall, wallRow, wallCol, line.color!)) {
  throw new Error('Cannot place tile at this position: position occupied or same color adjacent');
}
```

**改进**:
- 移除固定位置检查
- 使用 `canPlaceOnWall` 检查相邻同色
- 玩家可以点击任意位置（只要合法）

#### D. 删除 `wallTilingPhase` 函数（第 222-325 行）
```typescript
// NOTE: wallTilingPhase (automatic) removed - now using manual placePatternLineToWall + finishWallTiling
```

**理由**:
- 旧函数基于固定位置自动 wall-tiling
- 与新规则冲突
- 已替换为手动 `placePatternLineToWall` + `finishWallTiling`

---

### 3️⃣ `src/App.tsx` - UI 组件

#### A. 更新 Import（第 1-4 行）
```typescript
import { canPlaceOnWall } from './azulTypes';
// 移除: WALL_PATTERN, getWallColumn
```

#### B. 修改 Pattern Line 点击提示（第 95-96 行）
```typescript
// BEFORE:
// setMessage(`Click the highlighted wall position at row ${lineIndex}, column ${expectedCol}`);

// AFTER:
setMessage(`Line L${lineIndex} selected. Click any valid (highlighted) wall position to place the tile.`);
```

#### C. 重写 Wall 渲染逻辑（第 418-504 行）

**关键改动**:

1. **移除预设颜色背景**:
```typescript
// BEFORE:
const patternColor = getWallPatternColor(rowIdx, colIdx);
backgroundColor: getColorHex(patternColor),

// AFTER:
backgroundColor: tile ? getColorHex(tile.color) : '#f8f9fa', // 空格显示浅灰
```

2. **计算合法格子**:
```typescript
// Check if this position is valid for wall-tiling
const isValidPlacement =
  walltiling_selectedLine &&
  walltiling_selectedLine.playerIdx === idx &&
  canPlaceOnWall(
    player.wall,
    rowIdx,
    colIdx,
    player.patternLines[walltiling_selectedLine.lineIdx].color!
  );
```

3. **高亮所有合法格子**:
```typescript
border: isValidPlacement
  ? '4px solid #40c057'  // 绿色粗边框
  : tile?.injured
  ? '4px solid red'
  : isInWallTilingMode && !tile
  ? '2px solid #ced4da'  // 非法格子灰色边框
  : '2px solid #dee2e6';
```

4. **非法格子置灰 + 提示**:
```typescript
opacity: isInWallTilingMode && !tile && !isValidPlacement ? 0.3 : 1,
cursor: isValidPlacement
  ? 'pointer'
  : isInWallTilingMode && !tile
  ? 'not-allowed'  // 禁止图标
  : 'default',
title: isInWallTilingMode && !tile && !isValidPlacement
  ? 'Cannot place: occupied or same color adjacent'
  : undefined,
```

5. **点击处理**:
```typescript
onClick={() => {
  if (tile?.injured) {
    handleWallTileClick(idx, rowIdx, colIdx);
  } else if (isValidPlacement) {
    handleWallTileClick(idx, rowIdx, colIdx);
  } else if (isInWallTilingMode && !tile) {
    setMessage('Cannot place tile here: position occupied or same color adjacent');
  }
}}
```

6. **空格内容**:
```typescript
// BEFORE: 显示预设颜色字母 (F/W/G/E/P)
// AFTER: 空格显示空白或箭头（合法时）
{tile ? (
  <>
    {tile.color[0].toUpperCase()}
    {tile.injured && <div>⚡</div>}
  </>
) : isValidPlacement ? (
  <div style={{ fontSize: '20px' }}>↓</div>
) : (
  ''  // 空格显示空白
)}
```

#### D. 删除 `getWallPatternColor` 函数（第 740-742 行）
```typescript
// REMOVED: No longer needed
```

---

### 4️⃣ `src/azulGame.test.ts` - 单元测试

#### A. 移除旧 Import（第 1-6 行）
```typescript
// REMOVED: wallTilingPhase
```

#### B. 移除旧测试（第 116-240 行）
```typescript
// NOTE: wallTilingPhase tests removed - now using manual placePatternLineToWall (see azulGame.walltiling.test.ts)

// REMOVED:
// - describe('wallTilingPhase')
// - 4 个 wallTilingPhase 测试
// - test('cannot place if wall already has this color in row')
```

**原因**: 这些测试基于固定位置规则，不再适用

---

### 5️⃣ `src/azulGame.walltiling.test.ts` - Wall-Tiling 测试

#### A. 新增 Import（第 3 行）
```typescript
import { canPlaceOnWall } from './azulTypes';
```

#### B. 新增测试套件（第 196-328 行）

**测试 1: 相邻同色禁止（4 个方向）**
```typescript
describe('canPlaceOnWall - adjacent same-color restriction', () => {
  test('rejects placement when same color is adjacent (right)', () => {
    // Place fire at [2,2]
    // Try to place fire at [2,3] - should fail
    expect(canPlaceOnWall(player.wall, 2, 3, 'fire')).toBe(false);
  });

  // 同样测试 left, up, down
});
```

**测试 2: 非相邻允许**
```typescript
test('allows placement when same color is NOT adjacent', () => {
  // Place fire at [2,2]
  // Try to place fire at [2,4] (2 positions away) - should succeed
  expect(canPlaceOnWall(player.wall, 2, 4, 'fire')).toBe(true);
});
```

**测试 3: 不同颜色相邻允许**
```typescript
test('allows placement of different color adjacent to existing tile', () => {
  // Place fire at [2,2]
  // Try to place water at [2,3] - should succeed
  expect(canPlaceOnWall(player.wall, 2, 3, 'water')).toBe(true);
});
```

**测试 4: 占用位置拒绝**
```typescript
test('rejects placement on occupied position', () => {
  // Try to place water at same position as fire - should fail
  expect(canPlaceOnWall(player.wall, 2, 2, 'water')).toBe(false);
});
```

**测试 5: placePatternLineToWall 强制执行限制**
```typescript
test('placePatternLineToWall enforces adjacent restriction', () => {
  // Place fire at [2,2]
  // Try to place fire pattern line at [2,3] - should throw
  expect(() => placePatternLineToWall(state, 0, 0, 2, 3)).toThrow('Cannot place tile at this position');
});
```

**测试 6: 空墙自由放置**
```typescript
test('player can place tiles anywhere on empty wall', () => {
  // Place fire at [2,2] (middle) - should succeed
  // Place water at [0,0] (corner) - should succeed
});
```

#### C. 移除旧测试（第 108 行）
```typescript
// NOTE: Removed test for "invalid wall position for this color" - no longer applicable with free placement
```

---

## 📊 测试覆盖

### 测试结果: **34/34 PASS** ✅

**测试套件**:
- ✅ `src/gameLogic.test.ts` - 8 passed
- ✅ `src/azulGame.test.ts` - 9 passed (移除 5 个旧测试)
- ✅ `src/azulGame.ui-flow.test.ts` - 2 passed
- ✅ `src/azulGame.walltiling.test.ts` - 15 passed (新增 9 个测试)

**新增测试（9 个）**:
1. ✅ 相邻同色禁止 - 右侧
2. ✅ 相邻同色禁止 - 左侧
3. ✅ 相邻同色禁止 - 上方
4. ✅ 相邻同色禁止 - 下方
5. ✅ 非相邻同色允许
6. ✅ 不同颜色相邻允许
7. ✅ 占用位置拒绝
8. ✅ placePatternLineToWall 强制执行限制
9. ✅ 空墙自由放置

**移除测试（5 个）**:
- ❌ wallTilingPhase - 4 个自动 wall-tiling 测试
- ❌ cannot place if wall already has this color in row

---

## 🎮 UI 交互流程

### 流程 1: 选择满行并高亮合法格子

```
1. Wall-tiling 阶段开始（所有 factories 空）
   ↓
2. 玩家点击满行（绿色边框）Pattern Line L0
   ↓
3. Wall 进入选择态：
   - 合法格子：绿色粗边框 + 箭头 ↓ + 脉冲动画
   - 非法格子：灰色边框 + 半透明 (opacity: 0.3)
   - 已占位格子：正常显示（不可点击）
   ↓
4. 消息提示: "Line L0 selected. Click any valid (highlighted) wall position to place the tile."
```

### 流程 2: 点击合法格子放置

```
1. 鼠标悬停合法格子（绿色边框 + ↓）
   ↓
2. 点击合法格子
   ↓
3. Tile 立即出现在 Wall 上（实心颜色）
   ↓
4. Pattern Line L0 清空
   ↓
5. 分数增加（Azul 计分）
   ↓
6. 检查 Pokémon 受伤/kill 规则（基于相克）
   ↓
7. 消息更新: "Tile placed! Select another completed pattern line..."
```

### 流程 3: 点击非法格子

```
1. 鼠标悬停非法格子（灰色 + 半透明）
   ↓
2. 鼠标显示 🚫 (cursor: not-allowed)
   ↓
3. Tooltip 提示: "Cannot place: occupied or same color adjacent"
   ↓
4. 点击非法格子
   ↓
5. 消息显示: "Cannot place tile here: position occupied or same color adjacent"
   ↓
6. 不改变状态，继续等待合法点击
```

---

## 🎨 UI 视觉效果

### Wall 状态

**正常状态（非 wall-tiling）**:
```
┌──┬──┬──┬──┬──┐
│  │  │  │  │  │  ← 空格：浅灰背景 (#f8f9fa)
├──┼──┼──┼──┼──┤
│  │🔥│  │  │  │  ← 已放置：实心颜色 + 字母
├──┼──┼──┼──┼──┤
│  │  │  │  │  │
└──┴──┴──┴──┴──┘
```

**Wall-tiling 选择态**:
```
┌══╬──┬──╬──┬──┐  ← 合法格子：绿色粗边框 + 箭头
║↓║  │  ║  │  │
╠══╬──┼──╬──┼──┤
│  │🔥│🚫│  │  │  ← 已占位 / 相邻同色：不可点击
├──┼──┼──┼──┼──┤
║↓║  │  ║↓║  │  ← 合法格子高亮
╚══╩──┴──╩══╩──┘
```

**CSS 样式**:
- 合法格子: `border: 4px solid #40c057, animation: pulse 1.5s infinite, boxShadow: 0 0 8px rgba(64,192,87,0.5)`
- 非法格子: `border: 2px solid #ced4da, opacity: 0.3, cursor: not-allowed`
- 已放置: `backgroundColor: getColorHex(tile.color), boxShadow: 0 2px 4px rgba(0,0,0,0.2)`

---

## 📐 规则验证

### 规则 1: 空墙自由放置 ✅

**测试**:
```typescript
// Wall 完全为空
state = placePatternLineToWall(state, 0, 0, 2, 2); // 中间
state = placePatternLineToWall(state, 0, 1, 0, 0); // 角落
state = placePatternLineToWall(state, 0, 2, 4, 4); // 对角
```

**结果**: 全部成功 ✅

### 规则 2: 相邻同色禁止 ✅

**测试场景**:
```
┌──┬──┬──┬──┬──┐
│  │  │  │  │  │
├──┼──┼──┼──┼──┤
│  │  │🚫│  │  │  ← [1,2] 不能放 fire (上方有 fire)
├──┼──┼──┼──┼──┤
│  │🚫│🔥│🚫│  │  ← [2,2] 已放 fire，四周不能再放 fire
├──┼──┼──┼──┼──┤
│  │  │🚫│  │  │  ← [3,2] 不能放 fire (上方有 fire)
└──┴──┴──┴──┴──┘
```

**验证**:
- ✅ canPlaceOnWall(wall, 1, 2, 'fire') → false
- ✅ canPlaceOnWall(wall, 2, 1, 'fire') → false
- ✅ canPlaceOnWall(wall, 2, 3, 'fire') → false
- ✅ canPlaceOnWall(wall, 3, 2, 'fire') → false

### 规则 3: 不同颜色相邻允许 ✅

**测试场景**:
```
┌──┬──┬──┬──┬──┐
│  │  │  │  │  │
├──┼──┼──┼──┼──┤
│  │  │💧│  │  │  ← [1,2] 可以放 water (与 fire 相邻但不同色)
├──┼──┼──┼──┼──┤
│  │🌿│🔥│🌿│  │  ← [2,1][2,3] 可以放 grass
├──┼──┼──┼──┼──┤
│  │  │💧│  │  │  ← [3,2] 可以放 water
└──┴──┴──┴──┴──┘
```

**验证**:
- ✅ canPlaceOnWall(wall, 1, 2, 'water') → true
- ✅ canPlaceOnWall(wall, 2, 1, 'grass') → true
- ✅ canPlaceOnWall(wall, 2, 3, 'grass') → true

### 规则 4: 非相邻同色允许 ✅

**测试场景**:
```
┌──┬──┬──┬──┬──┐
│🔥│  │  │  │  │  ← [0,0] 可以放 fire
├──┼──┼──┼──┼──┤
│  │  │  │  │  │
├──┼──┼──┼──┼──┤
│  │  │🔥│  │🔥│  ← [2,2][2,4] 放 fire（相隔一格）
├──┼──┼──┼──┼──┤
│  │  │  │  │  │
└──┴──┴──┴──┴──┘
```

**验证**:
- ✅ canPlaceOnWall(wall, 0, 0, 'fire') → true (对角远离)
- ✅ canPlaceOnWall(wall, 2, 4, 'fire') → true (相隔一格)
- ✅ canPlaceOnWall(wall, 4, 2, 'fire') → true (相隔一行)

---

## 🚀 交付总结

**状态**: ✅ **COMPLETE**

**修改文件**:
1. ✅ `src/azulTypes.ts` - 新增 canPlaceOnWall，移除旧规则
2. ✅ `src/azulGame.ts` - 修改 placePatternLineToWall，删除 wallTilingPhase
3. ✅ `src/App.tsx` - 重写 Wall UI，高亮合法格子
4. ✅ `src/azulGame.test.ts` - 移除旧测试
5. ✅ `src/azulGame.walltiling.test.ts` - 新增 9 个测试

**核心功能**:
1. ✅ Wall 完全空白（无预设颜色）
2. ✅ 自由选择放置位置
3. ✅ 同属性相邻禁止（四邻检查）
4. ✅ 合法格子高亮（绿色边框 + 箭头）
5. ✅ 非法格子置灰 + 禁止点击
6. ✅ 错误提示友好

**测试结果**:
- ✅ 34/34 tests PASS
- ✅ Build SUCCESS (437ms)
- ✅ 覆盖所有相邻限制场景

**立即验收**:
1. 访问 http://localhost:5174/
2. 进入 wall-tiling 阶段
3. 点击满行 → 观察 Wall 所有合法格子高亮 ✨
4. 点击合法格子 → Tile 放置成功 ✨
5. 点击非法格子 → 显示错误提示 ✨
6. 尝试相邻同色 → 被拒绝 ✨

---

**🎊 Wall 自由放置规则实现完成！**
