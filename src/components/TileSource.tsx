import type { PokemonType } from '../types';

interface TileSourceProps {
  selectedType: PokemonType | null;
  onSelectType: (type: PokemonType) => void;
}

const AVAILABLE_TYPES: PokemonType[] = [
  'fire',
  'water',
  'grass',
  'electric',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
];

export default function TileSource({ selectedType, onSelectType }: TileSourceProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h3 style={{ margin: '0 0 8px 0' }}>Select Tile</h3>
      {AVAILABLE_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onSelectType(type)}
          style={{
            padding: '12px',
            backgroundColor: selectedType === type ? getTypeColor(type) : '#f5f5f5',
            border: selectedType === type ? '3px solid #000' : '2px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            textTransform: 'capitalize',
            fontWeight: selectedType === type ? 'bold' : 'normal',
            fontSize: '14px',
          }}
        >
          {type}
        </button>
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
