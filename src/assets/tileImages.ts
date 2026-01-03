import type { TileColor } from '../azulTypes';

/**
 * Simple hash function to convert tile ID to a number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Get the image path for a tile based on its type and ID
 * Uses stable random selection (same ID always returns same image)
 *
 * @param tileType - The Pokemon type (fire, water, grass, electric, psychic)
 * @param tileId - The unique tile ID
 * @returns Image path like "/img/pokemonazul_fire_3.png"
 */
export function getTileImagePath(tileType: TileColor, tileId: string): string {
  // Supported types with images
  const supportedTypes: TileColor[] = ['fire', 'water', 'grass', 'electric', 'psychic'];

  // Check if type has images
  if (!supportedTypes.includes(tileType)) {
    // Fallback for types without images (shouldn't happen in current game)
    console.warn(`No images for type: ${tileType}, using fire as fallback`);
    return getTileImagePath('fire', tileId);
  }

  // Hash tile ID to get stable random variant (1-4)
  const hash = hashString(tileId);
  const variant = (hash % 4) + 1; // 1, 2, 3, or 4

  return `/img/pokemonazul_${tileType}_${variant}.png`;
}

/**
 * Preload all tile images for better performance
 */
export function preloadTileImages(): void {
  const types: TileColor[] = ['fire', 'water', 'grass', 'electric', 'psychic'];
  const variants = [1, 2, 3, 4];

  types.forEach(type => {
    variants.forEach(variant => {
      const img = new Image();
      img.src = `/img/pokemonazul_${type}_${variant}.png`;
    });
  });
}
