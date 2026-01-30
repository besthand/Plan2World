import React, { useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Wall } from '../types';

// Augment JSX namespace to include React Three Fiber intrinsic elements
// This prevents TypeScript errors when @react-three/fiber types aren't automatically picked up
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      planeGeometry: any;
      meshBasicMaterial: any;
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      gridHelper: any;
    }
  }
}

interface Props {
  walls: Wall[];
  scalePPM: number; // Pixels per meter
  floorTextureSrc: string | null;
  imageWidth: number;
  imageHeight: number;
}

const WallMesh: React.FC<{ wall: Wall; scaleFactor: number }> = ({ wall, scaleFactor }) => {
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) * scaleFactor;
  const height = (wall.height / 100); // cm to meters
  const thickness = 0.15; // Fixed 15cm thickness in 3D for simplicity

  // Calculate center position
  const cx = ((wall.start.x + wall.end.x) / 2) * scaleFactor;
  const cy = ((wall.start.y + wall.end.y) / 2) * scaleFactor; // In 2D Y is down, in 3D Z is usually 'depth', Y is up

  // Calculate rotation angle
  const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);

  return (
    <mesh
      position={[cx, height / 2, cy]}
      rotation={[0, -angle, 0]} // Negative angle because Y axis is inverted in screen coords vs 3D world
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
    </mesh>
  );
};

const FloorPlane: React.FC<{ src: string | null; width: number; height: number; scaleFactor: number }> = ({ src, width, height, scaleFactor }) => {
  const texture = useMemo(() => src ? new THREE.TextureLoader().load(src) : null, [src]);
  
  if (!texture) return null;

  const w = width * scaleFactor;
  const h = height * scaleFactor;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w/2, 0.01, h/2]} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
};

const Viewer3D: React.FC<Props> = ({ walls, scalePPM, floorTextureSrc, imageWidth, imageHeight }) => {
  
  const scaleFactor = scalePPM > 0 ? 1 / scalePPM : 0.01;

  const centerX = (imageWidth * scaleFactor) / 2;
  const centerZ = (imageHeight * scaleFactor) / 2;

  return (
    <div className="w-full h-[600px] bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-2xl">
      <Canvas shadows camera={{ position: [centerX, 10, centerZ + 10], fov: 50 }}>
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 20, 100]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[centerX, 10, centerZ]} intensity={0.8} castShadow />
          <directionalLight 
            position={[centerX - 10, 10, centerZ - 10]} 
            intensity={0.5} 
            castShadow 
            shadow-mapSize={[1024, 1024]}
          />

          <FloorPlane 
            src={floorTextureSrc} 
            width={imageWidth} 
            height={imageHeight} 
            scaleFactor={scaleFactor} 
          />

          {walls.map(wall => (
            <WallMesh key={wall.id} wall={wall} scaleFactor={scaleFactor} />
          ))}

          <OrbitControls target={[centerX, 0, centerZ]} makeDefault />
          <Environment preset="city" />
          <gridHelper args={[100, 100]} position={[centerX, 0, centerZ]} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default Viewer3D;