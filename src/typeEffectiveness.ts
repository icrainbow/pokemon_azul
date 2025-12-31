import { PokemonType } from './types';

// Type effectiveness matrix: returns true if attackerType is super effective against defenderType
export function isSuperEffective(
  attackerType: PokemonType,
  defenderType: PokemonType
): boolean {
  const effectiveness: Record<PokemonType, PokemonType[]> = {
    normal: [],
    fire: ['grass', 'ice', 'bug', 'steel'],
    water: ['fire', 'ground', 'rock'],
    grass: ['water', 'ground', 'rock'],
    electric: ['water', 'flying'],
    ice: ['grass', 'ground', 'flying', 'dragon'],
    fighting: ['normal', 'ice', 'rock', 'dark', 'steel'],
    poison: ['grass', 'fairy'],
    ground: ['fire', 'electric', 'poison', 'rock', 'steel'],
    flying: ['grass', 'fighting', 'bug'],
    psychic: ['fighting', 'poison'],
    bug: ['grass', 'psychic', 'dark'],
    rock: ['fire', 'ice', 'flying', 'bug'],
    ghost: ['psychic', 'ghost'],
    dragon: ['dragon'],
    dark: ['psychic', 'ghost'],
    steel: ['ice', 'rock', 'fairy'],
    fairy: ['fighting', 'dragon', 'dark'],
  };

  return effectiveness[attackerType]?.includes(defenderType) ?? false;
}

// Check if adjacent tile restricts (is super effective against) the placed tile
export function restricts(
  adjacentType: PokemonType,
  placedType: PokemonType
): boolean {
  return isSuperEffective(adjacentType, placedType);
}
