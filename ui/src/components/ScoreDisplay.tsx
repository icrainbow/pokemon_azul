interface ScoreDisplayProps {
  score: number;
}

export default function ScoreDisplay({ score }: ScoreDisplayProps) {
  return (
    <div
      style={{
        padding: '16px 24px',
        backgroundColor: '#f8f9fa',
        border: '2px solid #dee2e6',
        borderRadius: '8px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '14px', color: '#868e96', marginBottom: '4px' }}>
        Total Score
      </div>
      <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#212529' }}>
        {score}
      </div>
    </div>
  );
}
