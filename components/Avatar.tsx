import React, { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { AppState } from '../types';

// The inner component that actually loads and controls the 3D model
const Model = ({ state }: { state: AppState }) => {
  const group = useRef<THREE.Group>(null);
  
  // Load the model from the public folder
  const { scene, animations } = useGLTF('/avatar.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // Stop all current animations before playing a new one
    Object.values(actions).forEach(action => action?.stop());

    // Because your model only has one animation track right now, 
    // we map every state to play the 'mixamo.com' animation so Aura keeps moving!
    const currentAction = actions['mixamo.com']; 

    if (currentAction) {
      currentAction.reset().fadeIn(0.5).play();
    }

    return () => {
      if (currentAction) currentAction.fadeOut(0.5);
    };
  }, [state, actions]);

  return (
    <group ref={group} dispose={null} position={[0, -1.5, 0]}>
      <primitive object={scene} />
    </group>
  );
};

// The main wrapper component
const Avatar: React.FC<{ state: AppState }> = ({ state }) => {
  return (
    <div className="relative flex items-center justify-center w-80 h-80 z-20">
      {/* Outer Glow Ring (kept for that sci-fi look) */}
      <div className={`
        absolute inset-0 rounded-full border border-white/10 transition-all duration-700
        ${state === AppState.LISTENING ? 'bg-rose-500/10 shadow-[0_0_60px_rgba(244,63,94,0.4)] border-rose-500/30' : ''}
        ${state === AppState.THINKING ? 'bg-amber-400/10 shadow-[0_0_60px_rgba(251,191,36,0.4)] border-amber-500/30 animate-pulse' : ''}
        ${state === AppState.TALKING ? 'bg-cyan-400/10 shadow-[0_0_60px_rgba(34,211,238,0.4)] border-cyan-500/30' : ''}
      `}></div>

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 2, 5]} intensity={1} />
        <Environment preset="city" /> {/* Gives the model realistic lighting reflections */}
        
        <React.Suspense fallback={null}>
          <Model state={state} />
        </React.Suspense>
        
        <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={5} blur={2} />
      </Canvas>
      
      {/* Status Label */}
      <div className="absolute -bottom-12 text-white/40 text-xs tracking-[0.3em] font-mono uppercase">
        {state}
      </div>
    </div>
  );
};

// Preload the model so it doesn't pop in late
useGLTF.preload('/avatar.glb');

export default Avatar;