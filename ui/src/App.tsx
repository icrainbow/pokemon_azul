import { useState } from 'react';
import { createWall, placeTile, matchHeal } from '@game/gameLogic';
import type { Wall, PokemonType, PokemonTile, Position } from '@game/types';
import WallGrid from './components/WallGrid';
import TileSource from './components/TileSource';
import ScoreDisplay from './components/ScoreDisplay';
import './App.css';

function App() {
  const [wall, setWall] = useState<Wall>(() => createWall(5, 5));
  const [selectedType, setSelectedType] = useState<PokemonType | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [nextTileId, setNextTileId] = useState(1);
  const [message, setMessage] = useState<string>('');

  const handleCellClick = (position: Position) => {
    if (!selectedType) {
      setMessage('Please select a tile type first!');
      return;
    }

    // Create a new tile
    const newTile: PokemonTile = {
      id: `tile-${nextTileId}`,
      type: selectedType,
      score: 0,
      penaltyCount: 0,
      injured: false,
    };

    try {
      const result = placeTile(wall, newTile, position);

      if (result.tileKilled) {
        setMessage(`Tile was killed! (penaltyCount reached 2)`);
        setWall(result.wall); // Wall remains unchanged when tile is killed
      } else {
        setWall(result.wall);
        setTotalScore((prev) => prev + result.scoreGained);
        setMessage(
          `Placed ${selectedType} tile! Score gained: ${result.scoreGained}${
            result.wall.tiles.get(newTile.id)?.injured ? ' (Injured!)' : ''
          }`
        );
      }

      setNextTileId((prev) => prev + 1);
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  const handleTileClick = (tileId: string) => {
    const tile = wall.tiles.get(tileId);
    if (!tile) return;

    if (tile.injured) {
      // Heal the tile
      const newWall = matchHeal(wall, tileId);
      setWall(newWall);
      setMessage(`Healed ${tile.type} tile! Injury removed.`);
    } else {
      setMessage(`This tile is not injured. (Click injured tiles to heal them)`);
    }
  };

  const handleReset = () => {
    setWall(createWall(5, 5));
    setTotalScore(0);
    setSelectedType(null);
    setNextTileId(1);
    setMessage('Game reset!');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '20px',
          borderBottom: '2px solid #dee2e6',
        }}
      >
        <h1 style={{ margin: 0 }}>Pokémon Azul</h1>
        <ScoreDisplay score={totalScore} />
      </div>

      {/* Message Display */}
      {message && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#e7f5ff',
            border: '1px solid #339af0',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          {message}
        </div>
      )}

      {/* Main Game Area */}
      <div style={{ display: 'flex', gap: '40px' }}>
        {/* Left: Tile Source */}
        <div style={{ flex: '0 0 200px' }}>
          <TileSource selectedType={selectedType} onSelectType={setSelectedType} />
        </div>

        {/* Right: Player Wall */}
        <div style={{ flex: '1' }}>
          <h3 style={{ marginTop: 0 }}>Player Wall (5x5)</h3>
          <WallGrid wall={wall} onCellClick={handleCellClick} onTileClick={handleTileClick} />
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              Reset Game
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div
        style={{
          marginTop: '40px',
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
        }}
      >
        <h4 style={{ marginTop: 0 }}>How to Play:</h4>
        <ul style={{ marginBottom: 0 }}>
          <li>Select a Pokémon type from the left panel</li>
          <li>Click an empty cell on the wall to place the tile</li>
          <li>Score is calculated based on adjacency (Azul rules)</li>
          <li>
            If a restricting type is adjacent, tile gets injured (red border ⚡) and score is
            reduced by 1
          </li>
          <li>Click an injured tile to heal it (removes injury, score unchanged)</li>
          <li>If a tile reaches penaltyCount ≥ 2, it's killed and disappears</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
