export type Point = {
  x: number;
  y: number;
};

export type Wall = {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  height: number; // in cm
};

export type AppStep = 'upload' | 'crop' | 'scale' | 'editor' | 'view3d';

export interface ProjectState {
  originalImageSrc: string | null;
  croppedImageSrc: string | null;
  scalePixelsPerMeter: number; // How many pixels represent 1 meter
  walls: Wall[];
  isProcessing: boolean;
}