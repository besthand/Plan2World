import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AppStep, Point, Wall } from '../types';
import { analyzeFloorPlan } from '../services/geminiService';

interface Props {
  step: AppStep;
  imageSrc: string | null;
  onCropComplete: (croppedSrc: string) => void;
  onScaleComplete: (pixelsPerMeter: number) => void;
  onAnalysisComplete: (walls: Wall[]) => void;
  existingWalls: Wall[];
  scale: number;
}

type Tool = 'draw' | 'eraser';

const CanvasEditor: React.FC<Props> = ({ 
  step, 
  imageSrc, 
  onCropComplete, 
  onScaleComplete, 
  onAnalysisComplete,
  existingWalls,
  scale
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  
  // Interaction States
  const [tool, setTool] = useState<Tool>('draw');
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  // Scale Tool State
  const [scaleDistanceMeters, setScaleDistanceMeters] = useState<string>('1.0');
  
  // Wall Draw Tool State
  const [walls, setWalls] = useState<Wall[]>(existingWalls);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Update local walls when props change
  useEffect(() => {
    setWalls(existingWalls);
  }, [existingWalls]);

  // Handle Shift Key for Orthographic mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if(e.key === 'Shift') setIsShiftPressed(true); };
    const handleKeyUp = (e: KeyboardEvent) => { if(e.key === 'Shift') setIsShiftPressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Load Image
  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        setImgElement(img);
        fitCanvasToImage(img);
      };
    }
  }, [imageSrc]);

  const fitCanvasToImage = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set internal resolution to match image natural size
    canvas.width = img.width;
    canvas.height = img.height;
    
    drawCanvas(img);
  };

  // Distance from point to line segment (for eraser)
  const distanceToSegment = (p: Point, v: Point, w: Point) => {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  const getSnappedPoint = (start: Point, current: Point): Point => {
    if (!isShiftPressed) return current;
    const dx = Math.abs(current.x - start.x);
    const dy = Math.abs(current.y - start.y);
    if (dx > dy) {
        return { x: current.x, y: start.y }; // Horizontal
    } else {
        return { x: start.x, y: current.y }; // Vertical
    }
  };

  const drawCanvas = useCallback((img: HTMLImageElement | null = imgElement) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Overlay logic based on step
    if (step === 'crop' && startPoint && currentPoint) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      const w = currentPoint.x - startPoint.x;
      const h = currentPoint.y - startPoint.y;
      ctx.strokeRect(startPoint.x, startPoint.y, w, h);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(startPoint.x, startPoint.y, w, h);
    }

    if (step === 'scale' && startPoint && currentPoint) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();
      
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, 8, 0, Math.PI * 2);
      ctx.arc(currentPoint.x, currentPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    if (step === 'editor') {
      // Draw Walls
      ctx.lineCap = 'round';
      
      walls.forEach(wall => {
        const isHovered = wall.id === hoveredWallId && tool === 'eraser';
        
        ctx.strokeStyle = isHovered ? '#ef4444' : '#10b981'; // Red if erasing, Green otherwise
        ctx.lineWidth = isHovered ? 8 : (wall.thickness > 0 ? wall.thickness : 5);
        ctx.shadowBlur = isHovered ? 10 : 0;
        ctx.shadowColor = '#ef4444';

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(wall.start.x, wall.start.y);
        ctx.lineTo(wall.end.x, wall.end.y);
        ctx.stroke();

        ctx.shadowBlur = 0; // Reset

        // Joints
        ctx.fillStyle = isHovered ? '#b91c1c' : '#059669';
        ctx.beginPath();
        ctx.arc(wall.start.x, wall.start.y, ctx.lineWidth/2, 0, Math.PI * 2);
        ctx.arc(wall.end.x, wall.end.y, ctx.lineWidth/2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw active line (Drawing mode)
      if (isDragging && startPoint && currentPoint && tool === 'draw') {
        const snapped = getSnappedPoint(startPoint, currentPoint);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 10;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(snapped.x, snapped.y);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    }
  }, [imgElement, step, startPoint, currentPoint, walls, hoveredWallId, tool, isShiftPressed]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const getCanvasCoordinates = (e: React.MouseEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pt = getCanvasCoordinates(e);
    if (!pt) return;

    if (step === 'editor' && tool === 'eraser') {
        // Erase logic handles in Click/Up usually, but let's do click for immediate
        // handled in Click for simple eraser
        return;
    }

    setIsDragging(true);
    setStartPoint(pt);
    setCurrentPoint(pt);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pt = getCanvasCoordinates(e);
    if (!pt) return;

    if (isDragging) {
        setCurrentPoint(pt);
    } else if (step === 'editor' && tool === 'eraser') {
        // Hover effect for eraser
        const threshold = 15; // pixels
        const found = walls.find(w => distanceToSegment(pt, w.start, w.end) < threshold);
        setHoveredWallId(found ? found.id : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (step === 'editor' && tool === 'eraser') {
        // Eraser Click Action
        const pt = getCanvasCoordinates(e);
        if(pt) {
            const threshold = 15;
            const wallToRemove = walls.find(w => distanceToSegment(pt, w.start, w.end) < threshold);
            if (wallToRemove) {
                const newWalls = walls.filter(w => w.id !== wallToRemove.id);
                setWalls(newWalls);
                onAnalysisComplete(newWalls);
                setHoveredWallId(null);
            }
        }
    } else if (isDragging && startPoint && currentPoint) {
        setIsDragging(false);

        if (step === 'editor' && tool === 'draw') {
            const snapped = getSnappedPoint(startPoint, currentPoint);
            const length = Math.hypot(snapped.x - startPoint.x, snapped.y - startPoint.y);
            if (length > 10) {
                const newWall: Wall = {
                id: `manual-wall-${Date.now()}`,
                start: startPoint,
                end: snapped,
                thickness: 15,
                height: 240
                };
                const updatedWalls = [...walls, newWall];
                setWalls(updatedWalls);
                onAnalysisComplete(updatedWalls);
            }
        }
    } else {
        setIsDragging(false);
    }
  };

  // Action Handlers
  const executeCrop = () => {
    if (!canvasRef.current || !startPoint || !currentPoint || !imgElement) return;
    
    const x = Math.round(Math.min(startPoint.x, currentPoint.x));
    const y = Math.round(Math.min(startPoint.y, currentPoint.y));
    const w = Math.round(Math.abs(currentPoint.x - startPoint.x));
    const h = Math.round(Math.abs(currentPoint.y - startPoint.y));

    if (w < 50 || h < 50) {
        alert("Crop area too small");
        return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(imgElement, x, y, w, h, 0, 0, w, h);
    const croppedUrl = tempCanvas.toDataURL('image/png');
    onCropComplete(croppedUrl);
  };

  const executeScale = () => {
    if (!startPoint || !currentPoint) {
        alert("Please draw a line first to set scale.");
        return;
    }
    const pixelDistance = Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y);
    const realMeters = parseFloat(scaleDistanceMeters);
    if (isNaN(realMeters) || realMeters <= 0) {
        alert("Invalid distance");
        return;
    }
    const ppm = pixelDistance / realMeters;
    onScaleComplete(ppm);
  };

  const executeAiDetection = async () => {
    if (!canvasRef.current || !imgElement) return;
    setIsAiLoading(true);
    
    const base64 = canvasRef.current.toDataURL('image/png');
    const result = await analyzeFloorPlan(base64, canvasRef.current.width, canvasRef.current.height);
    
    setIsAiLoading(false);
    if (result.walls.length > 0) {
        const newWalls = [...walls, ...result.walls];
        setWalls(newWalls);
        onAnalysisComplete(newWalls);
    } else {
        alert("AI couldn't detect any walls. Try manually drawing.");
    }
  };

  const clearWalls = () => {
    setWalls([]);
    onAnalysisComplete([]);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-800 p-3 rounded-lg border border-slate-700 sticky top-0 z-10 shadow-lg">
        
        {/* Instructions */}
        <div className="text-slate-300 text-sm font-medium flex items-center gap-2 border-r border-slate-700 pr-4">
            {step === 'crop' && '📦 Draw a box to crop'}
            {step === 'scale' && '📏 Draw a reference line'}
            {step === 'editor' && '✏️ Draw Walls'}
        </div>

        {step === 'editor' && (
            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg">
                <button 
                    onClick={() => setTool('draw')}
                    className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors ${
                        tool === 'draw' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <span>✏️ Draw</span>
                </button>
                <button 
                    onClick={() => setTool('eraser')}
                    className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors ${
                        tool === 'eraser' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <span>🗑️ Eraser</span>
                </button>
                <div className="text-xs text-slate-500 px-2 border-l border-slate-800">
                    Hold <span className="bg-slate-800 px-1 rounded border border-slate-700 text-slate-300">Shift</span> to snap
                </div>
            </div>
        )}

        {step === 'scale' && (
            <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-slate-400">Length (m):</span>
                <input 
                    type="number" 
                    value={scaleDistanceMeters} 
                    onChange={e => setScaleDistanceMeters(e.target.value)}
                    className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white"
                />
                <button 
                    onClick={executeScale}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-sm font-medium"
                >
                    Set Scale
                </button>
            </div>
        )}

        {step === 'crop' && (
            <button 
                onClick={executeCrop}
                className="ml-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-sm font-medium"
            >
                Apply Crop
            </button>
        )}

        {step === 'editor' && (
            <div className="flex items-center gap-2 ml-auto">
                <button 
                    onClick={clearWalls}
                    className="text-red-400 hover:text-red-300 px-3 py-1.5 text-sm font-medium"
                >
                    Clear All
                </button>
                <button 
                    onClick={executeAiDetection}
                    disabled={isAiLoading}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium text-white transition-all
                        ${isAiLoading ? 'bg-purple-900 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/20'}
                    `}
                >
                   {isAiLoading ? 'Detecting...' : '✨ AI Detect'}
                </button>
            </div>
        )}
      </div>

      {/* Canvas Container */}
      <div 
        ref={containerRef} 
        className={`relative w-full bg-slate-900 rounded-lg border border-slate-700 p-4 overflow-auto min-h-[500px] max-h-[80vh] flex cursor-crosshair
            ${tool === 'eraser' && step === 'editor' ? 'cursor-alias' : ''}
        `}
      >
        <canvas 
            ref={canvasRef}
            className="shadow-2xl max-w-full m-auto block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDragging(false)}
        />
      </div>
    </div>
  );
};

export default CanvasEditor;