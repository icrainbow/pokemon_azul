export type PokemonType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy';

export type PokemonTile = {
  id: string;
  type: PokemonType;
  score: number;
  penaltyCount: number;
  injured: boolean;
};

export type Position = {
  row: number;
  col: number;
};

export type Wall = {
  tiles: Map<string, PokemonTile>;
  grid: Map<string, string>; // position key -> tile id
  size: { rows: number; cols: number };
};

export type PlacementResult = {
  wall: Wall;
  scoreGained: number;
  tileKilled: boolean;
};
