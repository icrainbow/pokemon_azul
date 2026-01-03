import type { PokemonTile, Wall, Position } from '@game/types';

interface WallGridProps {
  wall: Wall;
  onCellClick: (position: Position) => void;
  onTileClick: (tileId: string) => void;
}

export default function WallGrid({ wall, onCellClick, onTileClick }: WallGridProps) {
  const { rows, cols } = wall.size;

  const getTileAtPosition = (row: number, col: number): PokemonTile | null => {
    const key = `${row},${col}`;
    const tileId = wall.grid.get(key);
    if (!tileId) return null;
    return wall.tiles.get(tileId) || null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} style={{ display: 'flex', gap: '4px' }}>
          {Array.from({ length: cols }).map((_, col) => {
            const tile = getTileAtPosition(row, col);
            return (
              <div
                key={`${row}-${col}`}
                onClick={() => {
                  if (tile) {
                    onTileClick(tile.id);
                  } else {
                    onCellClick({ row, col });
                  }
                }}
                style={{
                  width: '80px',
                  height: '80px',
                  border: tile?.injured ? '4px solid red' : '2px solid #ccc',
                  backgroundColor: tile ? getTypeColor(tile.type) : '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'capitalize',
                }}
              >
                {tile ? (
                  <div style={{ textAlign: 'center' }}>
                    <div>{tile.type}</div>
                    {tile.injured && <div style={{ color: 'red', fontSize: '10px' }}>⚡</div>}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    fire: '#ff6b6b',
    water: '#4dabf7',
    grass: '#51cf66',
    electric: '#ffd43b',
    ice: '#a5d8ff',
    fighting: '#cc5500',
    poison: '#9c36b5',
    ground: '#b8860b',
    flying: '#74c0fc',
    psychic: '#ff6bd6',
    bug: '#a9e34b',
    rock: '#8b7355',
    ghost: '#6741d9',
    dragon: '#7950f2',
    dark: '#495057',
    steel: '#adb5bd',
    fairy: '#faa2c1',
    normal: '#e9ecef',
  };
  return colors[type] || '#e9ecef';
}
