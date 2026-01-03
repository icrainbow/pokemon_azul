import { useState, useEffect, useRef } from 'react';
import { initGame, takeTiles, placeToPatternLine, placePatternLineToWall, finishWallTiling, healTile } from './azulGame';
import type { AzulState, TileColor, Factory } from './azulTypes';
import { canPlaceOnWall, hasAnyFilledPatternLine, isRoundEnded, canPlaceToPatternLine, rowHasColor } from './azulTypes';
import { getTileImagePath, preloadTileImages } from './assets/tileImages';

// Type letter mapping for wall tile badges
const TYPE_LETTER = {
  water: 'W',
  fire: 'F',
  grass: 'G',
  psychic: 'P',
  electric: 'E',
} as const;

function App() {
  const [gameState, setGameState] = useState<AzulState>(() => initGame(2));
  const [selectedSource, setSelectedSource] = useState<{ type: 'factory' | 'center'; id: number | null } | null>(null);
  const [selectedColor, setSelectedColor] = useState<TileColor | null>(null);
  const [message, setMessage] = useState<string>('Game started! Player 1\'s turn.');
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);
  const [showOpeningAnimation, setShowOpeningAnimation] = useState<boolean>(true);

  // Wall tiling state
  const [walltiling_selectedLine, setWalltilingSelectedLine] = useState<{ playerIdx: number; lineIdx: number } | null>(null);

  // Refs for auto-scroll to current player
  const playerRefs = useRef<(HTMLDivElement | null)[]>([]);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  // Auto-scroll to current player when currentPlayerIndex changes
  useEffect(() => {
    // Only auto-scroll if not in the middle of an interaction
    // (i.e., no source selected, no wall-tiling selection in progress)
    if (!selectedSource && !walltiling_selectedLine) {
      const targetElement = playerRefs.current[gameState.currentPlayerIndex];
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [gameState.currentPlayerIndex, selectedSource, walltiling_selectedLine]);

  // Preload tile images on mount
  useEffect(() => {
    preloadTileImages();
  }, []);

  // Opening animation effect
  useEffect(() => {
    if (showOpeningAnimation) {
      const timer = setTimeout(() => {
        setShowOpeningAnimation(false);
      }, 1800); // 1.8 seconds
      return () => clearTimeout(timer);
    }
  }, [showOpeningAnimation]);

  // Auto-floored tiles message
  useEffect(() => {
    if (gameState.autoFlooredTiles) {
      setMessage('No valid pattern lines. Tiles moved to Floor.');
      // Clear the flag by creating a new state without it
      const newState = { ...gameState };
      delete newState.autoFlooredTiles;
      setGameState(newState);
    }
  }, [gameState.autoFlooredTiles]);

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

  const handleFactoryClick = (factoryId: number) => {
    if (gameState.gameEnded) {
      setMessage('Game has ended! Please start a new game.');
      return;
    }

    if (gameState.phase !== 'factory-offer') {
      setMessage('Can only select tiles during factory-offer phase!');
      return;
    }

    // Toggle selection: if already selected, deselect
    if (selectedSource?.type === 'factory' && selectedSource.id === factoryId) {
      setSelectedSource(null);
      setSelectedColor(null);
      setMessage('Factory deselected.');
      return;
    }

    setSelectedSource({ type: 'factory', id: factoryId });
    setSelectedColor(null);
    setMessage(`Selected Factory ${factoryId + 1}. Choose a color from the factory.`);
  };

  const handleCenterClick = () => {
    if (gameState.gameEnded) {
      setMessage('Game has ended! Please start a new game.');
      return;
    }

    if (gameState.phase !== 'factory-offer') {
      setMessage('Can only select tiles during factory-offer phase!');
      return;
    }

    // Toggle selection
    if (selectedSource?.type === 'center') {
      setSelectedSource(null);
      setSelectedColor(null);
      setMessage('Center deselected.');
      return;
    }

    setSelectedSource({ type: 'center', id: null });
    setSelectedColor(null);
    setMessage('Selected Center. Choose a color from the center.');
  };

  const handleColorSelect = (color: TileColor, sourceType: 'factory' | 'center', sourceId: number | null) => {
    try {
      const newState = takeTiles(gameState, sourceType, sourceId, color);
      setGameState(newState);
      setSelectedSource(null);
      setSelectedColor(null);
      setMessage(`Took ${newState.takenTiles?.length || 0} ${color} tiles. Select a pattern line (L0-L4) to place them.`);
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  const handlePatternLineClick = (playerIdx: number, lineIndex: number) => {
    if (gameState.gameEnded) {
      setMessage('Game has ended! Please start a new game.');
      return;
    }

    // Wall-tiling phase: select completed line for wall placement
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

    // Factory-offer phase: place taken tiles to pattern line
    if (!gameState.takenTiles || gameState.takenTiles.length === 0) {
      setMessage('Please take tiles from factory/center first!');
      return;
    }

    if (playerIdx !== gameState.currentPlayerIndex) {
      setMessage('Can only place tiles on current player\'s board.');
      return;
    }

    try {
      const newState = placeToPatternLine(gameState, lineIndex);
      setGameState(newState);
      setSelectedSource(null);
      setSelectedColor(null);

      if (newState.phase === 'wall-tiling') {
        setMessage('Round End: All factories empty! Enter Wall Tiling phase. Select a completed pattern line to place on wall.');
      } else {
        setMessage(`Player ${newState.currentPlayerIndex + 1}'s turn.`);
      }
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  const handleFinishRound = () => {
    if (gameState.gameEnded) {
      setMessage('Game has ended! Please start a new game.');
      return;
    }

    if (gameState.phase !== 'wall-tiling') {
      setMessage('Can only finish round during wall-tiling phase.');
      return;
    }

    // Check if there are still completed lines
    const hasCompletedLines = gameState.players.some(p =>
      p.patternLines.some(line => line.tiles.length === line.capacity)
    );

    if (hasCompletedLines) {
      setMessage('Please process all completed pattern lines before finishing the round.');
      return;
    }

    try {
      // Show loading message
      setLoadingMessage('Applying floor penalties...');

      setTimeout(() => {
        const oldRound = gameState.round;
        const newState = finishWallTiling(gameState);

        // Check if game ended
        if (newState.phase === 'game-end') {
          setGameState(newState);
          setWalltilingSelectedLine(null);
          setLoadingMessage('');
          setShowWinnerModal(true);
          setMessage('Game Over!');
          return;
        }

        // Game continues
        setLoadingMessage('Dealing next round...');
        setTimeout(() => {
          setGameState(newState);
          setWalltilingSelectedLine(null);
          setLoadingMessage('');

          // Check if center has tiles (continuing same round) or starting new round
          if (newState.round === oldRound) {
            setMessage(`Floor penalties applied. Center still has tiles! Player ${newState.currentPlayerIndex + 1}'s turn to take from center.`);
          } else {
            setMessage(`Round ${newState.round} started! Player ${newState.currentPlayerIndex + 1}'s turn.`);
          }
        }, 500);
      }, 300);
    } catch (error) {
      setLoadingMessage('');
      if (error instanceof Error) {
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  const handleWallTileClick = (playerIndex: number, row: number, col: number) => {
    // Wall-tiling phase: place tile from selected pattern line to wall
    if (gameState.phase === 'wall-tiling' && walltiling_selectedLine) {
      if (walltiling_selectedLine.playerIdx !== playerIndex) {
        setMessage('Wall position must be in the same player board as the selected pattern line.');
        return;
      }

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
        if (error instanceof Error) {
          setMessage(`Error: ${error.message}`);
        }
      }
      return;
    }

    // Normal phase: heal injured tile
    const tile = gameState.players[playerIndex].wall.grid[row][col];
    if (!tile) {
      setMessage('No tile at this position.');
      return;
    }

    if (!tile.injured) {
      setMessage('This tile is not injured.');
      return;
    }

    try {
      const newState = healTile(gameState, playerIndex, row, col);
      setGameState(newState);
      setMessage(`Healed ${tile.color} tile at [${row},${col}]!`);
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  const handleNewGame = () => {
    setShowOpeningAnimation(true);
    setGameState(initGame(2));
    setSelectedSource(null);
    setSelectedColor(null);
    setWalltilingSelectedLine(null);
    setMessage('New game started! Player 1\'s turn.');
  };

  return (
    <div className="game-container" style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
      {/* Opening Animation */}
      {showOpeningAnimation && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 0.5s ease-in',
          }}
        >
          <style>
            {`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes scaleIn {
                from { transform: scale(0.8); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
              @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
              }
            `}
          </style>
          <div
            style={{
              textAlign: 'center',
              animation: 'scaleIn 0.8s ease-out',
            }}
          >
            <h1
              style={{
                fontSize: '48px',
                color: '#ffffff',
                marginBottom: '20px',
                fontWeight: 'bold',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              Pokémon Azul
            </h1>
            <h2
              style={{
                fontSize: '28px',
                color: '#ffd43b',
                marginBottom: '40px',
                fontWeight: '600',
              }}
            >
              A Game James Created with Mommy!
            </h2>
            <div
              style={{
                width: '400px',
                height: '300px',
                margin: '0 auto',
                backgroundColor: '#495057',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <img
                src="/img/pic1.jpeg"
                alt="James and Mommy"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  // Fallback if image doesn't exist
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div style="color: white; text-align: center; padding: 40px;">
                        <div style="font-size: 64px; margin-bottom: 20px;">👨‍👦</div>
                        <p style="font-size: 18px; margin: 0;">A Game For James and Mommy!</p>
                      </div>
                    `;
                  }
                }}
              />
            </div>
            <h3
              style={{
                fontSize: '24px',
                color: '#74c0fc',
                marginTop: '40px',
                fontWeight: '500',
              }}
            >
              A Game For James and Mommy!
            </h3>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="game-header">
        <h1>Pokémon Azul</h1>
        <div className="game-status-bar">
          <div className="status-segment">
            <span className="status-label">Phase:</span>
            <span className="status-value">{gameState.phase}</span>
          </div>
          <div className="status-segment">
            <span className="status-label">Round:</span>
            <span className="status-value">{gameState.round}</span>
          </div>
          <div className="status-segment">
            <div className="current-player-badge">
              ⭐ Player {gameState.currentPlayerIndex + 1}'s Turn
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="message-box">
          {message}
        </div>
      )}

      {/* Loading Toast */}
      {loadingMessage && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '20px 40px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            zIndex: 1000,
          }}
        >
          {loadingMessage}
        </div>
      )}

      {/* Winner Modal */}
      {showWinnerModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              maxWidth: '900px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <h2 style={{ margin: '0 0 30px 0', fontSize: '32px', color: '#228be6' }}>Game Over!</h2>

            {/* Winner and Loser Panels */}
            <div style={{
              display: 'flex',
              gap: '20px',
              marginBottom: '30px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}>
              {(() => {
                const maxScore = Math.max(...gameState.players.map(p => p.score));
                const winners = gameState.players.filter(p => p.score === maxScore);
                const losers = gameState.players.filter(p => p.score < maxScore);

                // Handle draw case
                if (winners.length > 1) {
                  return (
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#e7f5ff',
                      borderRadius: '8px',
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#228be6',
                      width: '100%',
                    }}>
                      It's a Draw!
                      <div style={{ marginTop: '15px', fontSize: '18px' }}>
                        {gameState.players.map((player, idx) => (
                          <div key={idx} style={{ marginTop: '10px' }}>
                            Player {idx + 1}: {player.score} points
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                const winner = winners[0];
                const loser = losers[0];

                return (
                  <>
                    {/* Winner Panel */}
                    <div style={{
                      flex: '1',
                      minWidth: '280px',
                      maxWidth: '400px',
                      padding: '20px',
                      backgroundColor: '#d3f9d8',
                      borderRadius: '12px',
                      border: '3px solid #40c057',
                    }}>
                      <div style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        color: '#2f9e44',
                        marginBottom: '15px',
                      }}>
                        🏆 Winner!
                      </div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        marginBottom: '10px',
                        color: '#2b8a3e',
                      }}>
                        Player {winner.playerId + 1}
                      </div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#2f9e44',
                        marginBottom: '15px',
                      }}>
                        {winner.score} points
                      </div>
                      <div style={{
                        width: '220px',
                        height: '220px',
                        margin: '0 auto',
                        borderRadius: '8px',
                        border: '2px solid #2b8a3e',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      }}>
                        <img
                          src="/img/youwin.jpeg"
                          alt="You Win!"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div style="
                                  display: flex;
                                  align-items: center;
                                  justify-content: center;
                                  height: 100%;
                                  background: linear-gradient(135deg, #40c057 0%, #2f9e44 100%);
                                  color: white;
                                  font-size: 48px;
                                ">🏆</div>
                              `;
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Loser Panel */}
                    <div style={{
                      flex: '1',
                      minWidth: '280px',
                      maxWidth: '400px',
                      padding: '20px',
                      backgroundColor: '#ffe3e3',
                      borderRadius: '12px',
                      border: '3px solid #fa5252',
                    }}>
                      <div style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        color: '#c92a2a',
                        marginBottom: '15px',
                      }}>
                        Better Luck Next Time
                      </div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        marginBottom: '10px',
                        color: '#c92a2a',
                      }}>
                        Player {loser.playerId + 1}
                      </div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#c92a2a',
                        marginBottom: '15px',
                      }}>
                        {loser.score} points
                      </div>
                      <div style={{
                        width: '220px',
                        height: '220px',
                        margin: '0 auto',
                        borderRadius: '8px',
                        border: '2px solid #c92a2a',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      }}>
                        <img
                          src="/img/youlost.jpeg"
                          alt="You Lost"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div style="
                                  display: flex;
                                  align-items: center;
                                  justify-content: center;
                                  height: 100%;
                                  background: linear-gradient(135deg, #fa5252 0%, #c92a2a 100%);
                                  color: white;
                                  font-size: 48px;
                                ">😢</div>
                              `;
                            }
                          }}
                        />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setGameState(initGame(2));
                  setShowWinnerModal(false);
                  setMessage('New game started! Player 1\'s turn.');
                }}
                style={{
                  padding: '12px 30px',
                  backgroundColor: '#40c057',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                New Game
              </button>
              <button
                onClick={() => {
                  setShowWinnerModal(false);
                  setMessage('Game has ended. Please start a New Game to continue.');
                }}
                style={{
                  padding: '12px 30px',
                  backgroundColor: '#868e96',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Game Area - Two-column layout */}
      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        {/* Left: Factories & Center - Sticky */}
        <div
          className="sticky-sidebar"
          style={{
            flex: '0 0 350px',
            position: 'sticky',
            top: '16px',
            alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
          }}
        >
          <h3 className="section-header">Factories</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {gameState.factories.map((factory) => (
              <FactoryDisplay
                key={factory.id}
                factory={factory}
                selected={selectedSource?.type === 'factory' && selectedSource.id === factory.id}
                onClick={() => handleFactoryClick(factory.id)}
                onColorClick={handleColorSelect}
                disabled={gameState.phase !== 'factory-offer' || factory.tiles.length === 0}
              />
            ))}
          </div>

          <h3 className="section-header">Center</h3>
          <CenterDisplay
            tiles={gameState.center.tiles}
            hasMarker={gameState.center.hasStartingPlayerMarker}
            selected={selectedSource?.type === 'center'}
            onClick={handleCenterClick}
            onColorClick={handleColorSelect}
            disabled={gameState.phase !== 'factory-offer' || gameState.center.tiles.length === 0}
          />
        </div>

        {/* Right: Player Boards */}
        <div style={{ flex: '1' }}>
          {gameState.players.map((player, idx) => {
            // Determine if this player should be highlighted
            const shouldHighlight = idx === gameState.currentPlayerIndex &&
              (gameState.phase !== 'wall-tiling' || hasAnyFilledPatternLine(player.patternLines));

            return (
              <div
                key={player.playerId}
                ref={(el) => (playerRefs.current[idx] = el)}
                id={`player-${idx}-board`}
                className={`player-board ${shouldHighlight ? 'current-player' : 'inactive'}`}
                style={{
                  scrollMarginTop: '80px',
                }}
              >
              {/* Losing Animation Overlay */}
              {gameState.gameEnded && (() => {
                const maxScore = Math.max(...gameState.players.map(p => p.score));
                const isLoser = player.score < maxScore;
                return isLoser ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 100,
                      animation: 'shake 0.5s ease-in-out',
                      pointerEvents: 'none',
                    }}
                  >
                    <style>
                      {`
                        @keyframes shake {
                          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
                          25% { transform: translate(-48%, -50%) rotate(-5deg); }
                          75% { transform: translate(-52%, -50%) rotate(5deg); }
                        }
                      `}
                    </style>
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src="/img/pic2.jpeg"
                        alt="You Lost"
                        style={{
                          width: '200px',
                          height: 'auto',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div style="
                                background: rgba(220, 53, 69, 0.9);
                                color: white;
                                padding: 20px 40px;
                                border-radius: 8px;
                                font-size: 32px;
                                font-weight: bold;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                              ">You Lost!</div>
                            `;
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : null;
              })()}
              <div className="player-board-header">
                <div className="player-name">
                  <span>Player {idx + 1}</span>
                  {player.isStartingPlayer && <span style={{ fontSize: '28px' }}>⭐</span>}
                </div>
                <div className="player-score">
                  Score: {player.score}
                </div>
              </div>

              {/* Horizontal layout: Pattern Lines on left, Wall on right */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                {/* Pattern Lines - Always visible */}
                <div style={{ flex: '0 0 auto', minWidth: '280px', maxWidth: '320px' }}>
                  <h4 className="section-header" style={{ margin: '0 0 6px 0' }}>Pattern Lines</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {player.patternLines.map((line, lineIdx) => {
                    const isWallTilingPhase = gameState.phase === 'wall-tiling';
                    const isCompleted = line.tiles.length === line.capacity;

                    // Check if this line can accept the taken tiles
                    let canAcceptTiles = true;
                    let tooltipMessage = '';
                    if (idx === gameState.currentPlayerIndex && gameState.takenTiles && gameState.takenTiles.length > 0) {
                      const tileColor = gameState.takenTiles[0].color;
                      canAcceptTiles = canPlaceToPatternLine(player, lineIdx, tileColor);
                      if (!canAcceptTiles) {
                        if (line.color !== null && line.color !== tileColor) {
                          tooltipMessage = `Line has ${line.color} tiles`;
                        } else if (line.tiles.length >= line.capacity) {
                          tooltipMessage = 'Line is full';
                        } else if (rowHasColor(player.wall, lineIdx, tileColor)) {
                          tooltipMessage = `Row already has ${tileColor}`;
                        }
                      }
                    }

                    const isClickable =
                      ((idx === gameState.currentPlayerIndex && gameState.takenTiles && canAcceptTiles) ||
                      (isWallTilingPhase && isCompleted && idx === gameState.currentPlayerIndex));
                    const isSelected = walltiling_selectedLine?.playerIdx === idx && walltiling_selectedLine?.lineIdx === lineIdx;

                    // Determine pattern line CSS class
                    let patternLineClass = 'pattern-line';
                    if (isSelected) {
                      patternLineClass += ' selected';
                    } else if (isWallTilingPhase && isCompleted && idx === gameState.currentPlayerIndex) {
                      patternLineClass += ' completed';
                    } else if (idx === gameState.currentPlayerIndex && gameState.takenTiles && canAcceptTiles) {
                      patternLineClass += ' can-accept';
                    } else if (idx === gameState.currentPlayerIndex && gameState.takenTiles && !canAcceptTiles) {
                      patternLineClass += ' invalid';
                    }
                    if (isClickable) {
                      patternLineClass += ' clickable';
                    }

                    return (
                      <div
                        key={lineIdx}
                        onClick={() => isClickable && handlePatternLineClick(idx, lineIdx)}
                        title={tooltipMessage || undefined}
                        className={patternLineClass}
                      >
                      <div className="pattern-line-label">L{lineIdx}</div>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {Array.from({ length: line.capacity }).map((_, i) => {
                          const hasTile = i < line.tiles.length && line.color;
                          return (
                            <div
                              key={i}
                              className={hasTile ? 'tile' : ''}
                              style={{
                                width: '34px',
                                height: '34px',
                                backgroundColor: hasTile ? 'transparent' : '#e9ecef',
                                border: hasTile ? undefined : '1px solid #adb5bd',
                                borderRadius: '3px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              {hasTile && line.tiles[i] && (
                                <img
                                  src={getTileImagePath(line.color!, line.tiles[i].id)}
                                  alt={line.color!}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6c757d', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{line.tiles.length}/{line.capacity}</span>
                        {line.color && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: '#495057',
                            textTransform: 'capitalize',
                            backgroundColor: '#f8f9fa',
                            padding: '2px 6px',
                            borderRadius: '3px',
                          }}>
                            {line.color}
                          </span>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>

                  {/* Floor Line */}
                  <div className="floor-line" style={{ marginTop: '8px' }}>
                    <h4 className="floor-line-title" style={{ margin: '0 0 4px 0' }}>Floor: ({player.floorLine.tiles.length})</h4>
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', minHeight: '28px' }}>
                      {player.floorLine.hasStartingPlayerMarker && (
                        <div
                          style={{
                            padding: '4px 6px',
                            backgroundColor: '#ffd43b',
                            borderRadius: '3px',
                            fontWeight: 'bold',
                            fontSize: '11px',
                          }}
                        >
                          ⭐
                        </div>
                      )}
                      {player.floorLine.tiles.map((tile, i) => (
                        <div
                          key={i}
                          className="tile"
                          title={tile.color}
                        >
                          <img
                            src={getTileImagePath(tile.color, tile.id)}
                            alt={tile.color}
                            style={{
                              width: '34px',
                              height: '34px',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Wall */}
                <div style={{ flex: '1' }}>
                  <h4 className="section-header" style={{ margin: '0 0 6px 0' }}>Wall</h4>
                <div className="wall-grid">
                  {player.wall.grid.map((row, rowIdx) => (
                    <div key={rowIdx} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      {row.map((tile, colIdx) => {
                        // Check if this position is valid for wall-tiling
                        const isValidPlacement =
                          walltiling_selectedLine &&
                          walltiling_selectedLine.playerIdx === idx &&
                          walltiling_selectedLine.lineIdx === rowIdx && // Pattern line must match wall row
                          canPlaceOnWall(
                            player.wall,
                            rowIdx,
                            colIdx,
                            player.patternLines[walltiling_selectedLine.lineIdx].color!
                          );

                        const isInWallTilingMode = walltiling_selectedLine && walltiling_selectedLine.playerIdx === idx;

                        // Determine why placement is invalid (for tooltip)
                        let invalidReason = '';
                        if (isInWallTilingMode && !tile && !isValidPlacement && walltiling_selectedLine) {
                          const selectedColor = player.patternLines[walltiling_selectedLine.lineIdx].color!;
                          // Check if wrong row
                          if (walltiling_selectedLine.lineIdx !== rowIdx) {
                            invalidReason = `Pattern line ${walltiling_selectedLine.lineIdx + 1} can only place to row ${walltiling_selectedLine.lineIdx + 1}`;
                          } else if (rowHasColor(player.wall, rowIdx, selectedColor)) {
                            invalidReason = `Row already has ${selectedColor}`;
                          } else {
                            // Check for adjacent same color
                            const adjacents = [
                              [rowIdx - 1, colIdx],
                              [rowIdx + 1, colIdx],
                              [rowIdx, colIdx - 1],
                              [rowIdx, colIdx + 1],
                            ];
                            const hasAdjacentSameColor = adjacents.some(([r, c]) => {
                              if (r >= 0 && r < 5 && c >= 0 && c < 5) {
                                const adjTile = player.wall.grid[r][c];
                                return adjTile && adjTile.color === selectedColor;
                              }
                              return false;
                            });
                            invalidReason = hasAdjacentSameColor ? `Same color adjacent` : 'Invalid placement';
                          }
                        }

                        // Determine wall cell CSS class
                        let wallCellClass = 'wall-cell';
                        if (tile) {
                          wallCellClass += ' filled';
                          if (tile.injured) {
                            wallCellClass += ' injured';
                          }
                        } else if (isValidPlacement) {
                          wallCellClass += ' valid-placement';
                        } else if (isInWallTilingMode && !isValidPlacement) {
                          wallCellClass += ' invalid';
                        }

                        return (
                          <div
                            key={colIdx}
                            onClick={() => {
                              if (tile?.injured) {
                                handleWallTileClick(idx, rowIdx, colIdx);
                              } else if (isValidPlacement) {
                                handleWallTileClick(idx, rowIdx, colIdx);
                              } else if (isInWallTilingMode && !tile) {
                                setMessage(`Cannot place tile here: ${invalidReason}`);
                              }
                            }}
                            className={wallCellClass}
                            title={invalidReason || undefined}
                          >
                            {tile ? (
                              <>
                                <img
                                  src={getTileImagePath(tile.color, `wall-${idx}-${rowIdx}-${colIdx}`)}
                                  alt={tile.color}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                  }}
                                />
                                {/* Type letter badge */}
                                <div className={`type-badge ${tile.color}`}>
                                  {TYPE_LETTER[tile.color]}
                                </div>
                                {tile.injured && (
                                  <div style={{ position: 'absolute', top: '2px', right: '2px', fontSize: '16px', zIndex: 3 }}>
                                    ⚡
                                  </div>
                                )}
                              </>
                            ) : isValidPlacement ? (
                              <div style={{ fontSize: '20px' }}>↓</div>
                            ) : (
                              ''
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                </div>
              </div>
            </div>
            );
          })}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '20px' }}>
            {gameState.phase === 'wall-tiling' && (
              <button
                onClick={handleFinishRound}
                className="game-button primary"
              >
                Finish Round
              </button>
            )}
            <button
              onClick={handleNewGame}
              className="game-button danger"
            >
              New Game
            </button>
            {import.meta.env.DEV && (
              <button
                onClick={() => {
                  // Set scores to trigger game end modal
                  const newState = { ...gameState };
                  newState.players[0].score = 150;
                  newState.players[1].score = 100;
                  newState.phase = 'game-end';
                  newState.gameEnded = true;
                  setGameState(newState);
                  setShowWinnerModal(true);
                }}
                className="game-button secondary"
              >
                [DEV] Show End Modal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FactoryDisplay({
  factory,
  selected,
  onClick,
  onColorClick,
  disabled,
}: {
  factory: Factory;
  selected: boolean;
  onClick: () => void;
  onColorClick: (color: TileColor, sourceType: 'factory' | 'center', sourceId: number | null) => void;
  disabled: boolean;
}) {
  // Get available colors from this factory
  const availableColors = [...new Set(factory.tiles.map(t => t.color))];

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`factory-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
    >
      <div className="factory-title">
        Factory {factory.id + 1}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '40px' }}>
        {factory.tiles.map((tile, idx) => (
          <div
            key={idx}
            className="tile"
            style={{
              width: '51px',
              height: '51px',
            }}
            title={tile.color}
          >
            <img
              src={getTileImagePath(tile.color, tile.id)}
              alt={tile.color}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        ))}
        {factory.tiles.length === 0 && (
          <div style={{ fontSize: '12px', color: '#adb5bd', padding: '8px' }}>Empty</div>
        )}
      </div>

      {/* In-place color selection */}
      {selected && availableColors.length > 0 && (
        <div style={{ marginTop: '8px', borderTop: '1px solid #dee2e6', paddingTop: '8px' }}>
          <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '4px' }}>Choose color:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {availableColors.map((color) => {
              const count = factory.tiles.filter(t => t.color === color).length;
              return (
                <button
                  key={color}
                  onClick={(e) => {
                    e.stopPropagation();
                    onColorClick(color, 'factory', factory.id);
                  }}
                  className="color-select-button"
                  style={{
                    backgroundColor: getColorHex(color),
                    color: 'white',
                  }}
                  title={`${color} (${count} tiles)`}
                >
                  {color[0].toUpperCase()} ×{count}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CenterDisplay({
  tiles,
  hasMarker,
  selected,
  onClick,
  onColorClick,
  disabled,
}: {
  tiles: any[];
  hasMarker: boolean;
  selected: boolean;
  onClick: () => void;
  onColorClick: (color: TileColor, sourceType: 'factory' | 'center', sourceId: number | null) => void;
  disabled: boolean;
}) {
  // Get available colors from center
  const availableColors = [...new Set(tiles.map(t => t.color))];

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`center-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
    >
      <div className="center-title">
        Center {hasMarker && '⭐'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {tiles.map((tile, idx) => (
          <div
            key={idx}
            className="tile"
            style={{
              width: '51px',
              height: '51px',
            }}
            title={tile.color}
          >
            <img
              src={getTileImagePath(tile.color, tile.id)}
              alt={tile.color}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        ))}
        {tiles.length === 0 && !hasMarker && (
          <div style={{ fontSize: '12px', color: '#adb5bd', padding: '8px' }}>Empty</div>
        )}
      </div>

      {/* In-place color selection */}
      {selected && availableColors.length > 0 && (
        <div style={{ marginTop: '8px', borderTop: '1px solid #dee2e6', paddingTop: '8px' }}>
          <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '4px' }}>Choose color:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {availableColors.map((color) => {
              const count = tiles.filter(t => t.color === color).length;
              return (
                <button
                  key={color}
                  onClick={(e) => {
                    e.stopPropagation();
                    onColorClick(color, 'center', null);
                  }}
                  className="color-select-button"
                  style={{
                    backgroundColor: getColorHex(color),
                    color: 'white',
                  }}
                  title={`${color} (${count} tiles)`}
                >
                  {color[0].toUpperCase()} ×{count}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function getColorHex(color: TileColor): string {
  const colorMap: Record<TileColor, string> = {
    normal: '#a8a878',
    fire: '#f08030',
    water: '#6890f0',
    grass: '#78c850',
    electric: '#f8d030',
    ice: '#98d8d8',
    fighting: '#c03028',
    poison: '#a040a0',
    ground: '#e0c068',
    flying: '#a890f0',
    psychic: '#f85888',
    bug: '#a8b820',
    rock: '#b8a038',
    ghost: '#705898',
    dragon: '#7038f8',
    dark: '#705848',
    steel: '#b8b8d0',
    fairy: '#ee99ac',
  };
  return colorMap[color] || '#6c757d';
}

export default App;
