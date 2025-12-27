
import React, { useState, useCallback } from 'react';
import Experience from './components/Experience';
import { HandState, TreeMode } from './types';

const App: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handState, setHandState] = useState<HandState>({
    pinchDistance: 1,
    isOpen: true,
    isPinching: false,
    active: false,
    rotationSpeed: 0
  });

  const handleStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      setStarted(true);
    } catch (err) {
      setError("Webcam access is required for the experience. Please enable it and refresh.");
      console.error(err);
    }
  };

  const updateHandState = useCallback((state: HandState) => {
    setHandState(state);
  }, []);

  const currentMode = handState.isOpen ? TreeMode.MERRY : TreeMode.SILENT;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {!started && !error && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center p-8 max-w-md">
            <h1 className="text-5xl font-bold mb-4 text-white drop-shadow-lg">
              ✨ AI Christmas Magic
            </h1>
            <p className="text-gray-300 mb-8 text-lg">
              Decorate the tree with your hand! 
              <br/><br/>
              🔄 <b>Move finger in circles</b> to paint light trails.
              <br/>
              🖐️ <b>Open Hand</b> vs 👌 <b>Pinch</b> for different colors.
            </p>
            <button
              onClick={handleStart}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full text-xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-2xl"
            >
              Start Experience
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 text-center p-6">
          <div className="bg-red-900/20 border border-red-500 p-8 rounded-2xl max-w-sm">
            <h2 className="text-2xl font-bold text-red-500 mb-2">Error</h2>
            <p className="text-red-200">{error}</p>
          </div>
        </div>
      )}

      {started && (
        <>
          <Experience onHandUpdate={updateHandState} />
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none text-center">
            <div className={`px-8 py-3 rounded-full transition-all duration-500 border-2 ${
              handState.rotationSpeed > 0.05 
              ? 'bg-white/20 text-white border-white scale-110 shadow-[0_0_30px_rgba(255,255,255,0.4)]' 
              : 'bg-black/40 text-gray-400 border-white/10'
            }`}>
              <span className="text-lg font-bold tracking-widest uppercase">
                {handState.active ? (
                  handState.rotationSpeed > 0.05 ? '✨ Creating Magic ✨' : `Mode: ${currentMode}`
                ) : 'Show your hand to the camera'}
              </span>
            </div>
          </div>

          <div className="absolute top-8 left-8 text-white/30 text-[10px] font-mono uppercase tracking-widest">
            Hand Active: {handState.active ? 'YES' : 'NO'}<br/>
            Motion Velocity: {(handState.rotationSpeed * 100).toFixed(0)}%
          </div>
        </>
      )}
    </div>
  );
};

export default App;
