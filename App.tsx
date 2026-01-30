import React, { useState } from 'react';
import { ProjectState, AppStep, Wall } from './types';
import StepIndicator from './components/StepIndicator';
import CanvasEditor from './components/CanvasEditor';
import Viewer3D from './components/Viewer3D';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('upload');
  const [state, setState] = useState<ProjectState>({
    originalImageSrc: null,
    croppedImageSrc: null,
    scalePixelsPerMeter: 0,
    walls: [],
    isProcessing: false,
  });

  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          // Completely reset state for new project
          setState({
            originalImageSrc: ev.target!.result as string,
            croppedImageSrc: null,
            scalePixelsPerMeter: 0,
            walls: [],
            isProcessing: false,
          });
          setImgDims({ w: 0, h: 0 });
          setStep('crop');
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCropComplete = (croppedSrc: string) => {
    setState(prev => ({ ...prev, croppedImageSrc: croppedSrc }));
    
    const img = new Image();
    img.onload = () => setImgDims({ w: img.width, h: img.height });
    img.src = croppedSrc;

    setStep('scale');
  };

  const handleScaleComplete = (ppm: number) => {
    setState(prev => ({ ...prev, scalePixelsPerMeter: ppm }));
    setStep('editor');
  };

  const handleAnalysisComplete = (walls: Wall[]) => {
    setState(prev => ({ ...prev, walls }));
  };

  const goTo3D = () => {
    if (state.walls.length === 0) {
      if (!confirm("No walls defined. The 3D view will be empty. Continue?")) return;
    }
    setStep('view3d');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="font-bold text-white">3D</span>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Plan2World AI
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {step !== 'upload' && (
                <button 
                    onClick={() => window.location.reload()}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                    Start Over
                </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 pb-20">
        <StepIndicator currentStep={step} />

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-sm min-h-[600px]">
          
          {step === 'upload' && (
            <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 hover:border-blue-500/50 transition-all group">
              <div className="w-16 h-16 mb-4 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <label className="cursor-pointer">
                <span className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-blue-600/20 transition-all">
                  Select Floor Plan
                </span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
              <p className="mt-4 text-slate-400 text-sm">Supported: JPG, PNG, WEBP</p>
            </div>
          )}

          {(step === 'crop' || step === 'scale' || step === 'editor') && (
            <div className="flex flex-col gap-6">
               <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-white">
                    {step === 'crop' && 'Crop Area of Interest'}
                    {step === 'scale' && 'Calibrate Scale'}
                    {step === 'editor' && 'Define Walls'}
                  </h2>
                  
                  {step === 'editor' && (
                      <button 
                        onClick={goTo3D}
                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-green-600/20 flex items-center gap-2"
                      >
                        <span>Generate 3D Model</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </button>
                  )}
               </div>

               <CanvasEditor 
                 step={step}
                 imageSrc={step === 'crop' ? state.originalImageSrc : state.croppedImageSrc}
                 scale={state.scalePixelsPerMeter}
                 existingWalls={state.walls}
                 onCropComplete={handleCropComplete}
                 onScaleComplete={handleScaleComplete}
                 onAnalysisComplete={handleAnalysisComplete}
               />
            </div>
          )}

          {step === 'view3d' && (
             <div className="flex flex-col gap-6 h-full">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-white">3D Visualization</h2>
                    <button 
                        onClick={() => setStep('editor')}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                        Back to Editor
                    </button>
                </div>
                <div className="flex-1">
                    <Viewer3D 
                        walls={state.walls}
                        scalePPM={state.scalePixelsPerMeter}
                        floorTextureSrc={state.croppedImageSrc}
                        imageWidth={imgDims.w}
                        imageHeight={imgDims.h}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-400">
                    <div className="bg-slate-800 p-3 rounded border border-slate-700">
                        <div className="font-bold text-white mb-1">Controls</div>
                        Left Click: Rotate<br/>Right Click: Pan<br/>Scroll: Zoom
                    </div>
                    <div className="bg-slate-800 p-3 rounded border border-slate-700">
                        <div className="font-bold text-white mb-1">Stats</div>
                        Walls: {state.walls.length}
                    </div>
                </div>
             </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;