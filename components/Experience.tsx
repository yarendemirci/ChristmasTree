
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { HandState } from '../types';

interface ExperienceProps {
  onHandUpdate: (state: HandState) => void;
}

const lerp = (start: number, end: number, amt: number) => {
  return (1 - amt) * start + amt * end;
};

const Experience: React.FC<ExperienceProps> = ({ onHandUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const stateRef = useRef<HandState>({ 
    pinchDistance: 1, 
    isOpen: true, 
    isPinching: false, 
    active: false,
    rotationSpeed: 0 
  });
  
  const prevAngleRef = useRef<number | null>(null);
  const centerPosRef = useRef({ x: 0.5, y: 0.5 }); // Dynamic center based on hand movement

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    particles: THREE.Points;
    trailParticles: THREE.Points;
    star: THREE.Mesh;
    pointLight: THREE.PointLight;
    currentSize: number;
    currentSpeed: number;
    currentGlow: number;
    trailTheta: number;
    trailY: number;
    trailActivePoints: number;
  } | null>(null);

  useEffect(() => {
    const videoElement = document.getElementById('video-hidden') as HTMLVideoElement;
    const previewContainer = document.getElementById('preview-container');
    
    // Create a preview video that mirrors the hidden one
    const previewVideo = document.createElement('video');
    previewVideo.playsInline = true;
    previewVideo.muted = true;
    previewVideo.autoplay = true;
    previewVideo.srcObject = videoElement.srcObject;
    if (previewContainer) {
      previewContainer.appendChild(previewVideo);
    }
    
    // @ts-ignore
    const hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results: any) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const thumb = landmarks[4];
        const index = landmarks[8];
        const wrist = landmarks[0];
        
        // Use wrist and index mid-point to calculate a dynamic center for rotation
        // This makes it easier to rotate anywhere on screen
        centerPosRef.current.x = lerp(centerPosRef.current.x, wrist.x, 0.1);
        centerPosRef.current.y = lerp(centerPosRef.current.y, wrist.y, 0.1);

        const dx = thumb.x - index.x;
        const dy = thumb.y - index.y;
        const dz = thumb.z - index.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const isPinching = dist < 0.07; // Slightly more sensitive pinch

        // Calculate angle relative to wrist/center for more intuitive rotation
        const angle = Math.atan2(index.y - centerPosRef.current.y, index.x - centerPosRef.current.x);
        let rotationDelta = 0;
        if (prevAngleRef.current !== null) {
          rotationDelta = angle - prevAngleRef.current;
          // Handle angle wrap-around
          if (rotationDelta > Math.PI) rotationDelta -= Math.PI * 2;
          if (rotationDelta < -Math.PI) rotationDelta += Math.PI * 2;
        }
        prevAngleRef.current = angle;

        stateRef.current = {
          pinchDistance: dist,
          isPinching: isPinching,
          isOpen: !isPinching,
          active: true,
          rotationSpeed: Math.abs(rotationDelta)
        };
        onHandUpdate(stateRef.current);
      } else {
        stateRef.current.active = false;
        stateRef.current.rotationSpeed = 0;
        prevAngleRef.current = null;
        onHandUpdate(stateRef.current);
      }
    });

    // Use Camera utility but ensure it's linked correctly
    // @ts-ignore
    const camera = new window.Camera(videoElement, {
      onFrame: async () => {
        if (previewVideo.srcObject !== videoElement.srcObject) {
          previewVideo.srcObject = videoElement.srcObject;
        }
        await hands.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });
    camera.start();

    const width = window.innerWidth;
    const height = window.innerHeight;
    const scene = new THREE.Scene();
    const perspectiveCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    perspectiveCamera.position.set(0, 2, 11);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current?.appendChild(renderer.domElement);

    const treeHeight = 8;
    const baseRadius = 3.5;

    // Main Particle Tree
    const particleCount = 4500;
    const treeGeometry = new THREE.BufferGeometry();
    const treePos = new Float32Array(particleCount * 3);
    const treeColors = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const y = Math.random() * treeHeight;
      const radiusAtY = (1 - y / treeHeight) * baseRadius;
      const angle = Math.random() * Math.PI * 2;
      treePos[i * 3] = Math.cos(angle) * radiusAtY;
      treePos[i * 3 + 1] = y - treeHeight / 2;
      treePos[i * 3 + 2] = Math.sin(angle) * radiusAtY;
    }
    treeGeometry.setAttribute('position', new THREE.BufferAttribute(treePos, 3));
    treeGeometry.setAttribute('color', new THREE.BufferAttribute(treeColors, 3));
    const treeParticles = new THREE.Points(treeGeometry, new THREE.PointsMaterial({
      size: 0.1, vertexColors: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending
    }));
    scene.add(treeParticles);

    // Helix Trail System
    const trailCount = 2000;
    const trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(trailCount * 3);
    const trailColorsArr = new Float32Array(trailCount * 3);
    const trailLives = new Float32Array(trailCount);
    
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColorsArr, 3));
    trailGeometry.setAttribute('life', new THREE.BufferAttribute(trailLives, 1));
    
    const trailMaterial = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    trailMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        attribute float life;
        varying float vLife;
        ${shader.vertexShader}
      `.replace(
        `gl_PointSize = size;`,
        `gl_PointSize = size * life; vLife = life;`
      );
      shader.fragmentShader = `
        varying float vLife;
        ${shader.fragmentShader}
      `.replace(
        `gl_FragColor = vec4( diffuse, opacity );`,
        `gl_FragColor = vec4( diffuse, opacity * vLife );`
      );
    };

    const trailParticles = new THREE.Points(trailGeometry, trailMaterial);
    scene.add(trailParticles);

    // Star
    const star = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 2 })
    );
    scene.add(star);

    scene.add(new THREE.AmbientLight(0x202020));
    const pointLight = new THREE.PointLight(0xffaa00, 1, 15);
    pointLight.position.set(0, treeHeight / 2, 0);
    scene.add(pointLight);

    sceneRef.current = {
      renderer, scene, camera: perspectiveCamera, particles: treeParticles,
      trailParticles, star, pointLight, currentSize: 1, currentSpeed: 0.01,
      currentGlow: 0, trailTheta: 0, trailY: 0, trailActivePoints: 0
    };

    const onResize = () => {
      if (!sceneRef.current) return;
      sceneRef.current.renderer.setSize(window.innerWidth, window.innerHeight);
      sceneRef.current.camera.aspect = window.innerWidth / window.innerHeight;
      sceneRef.current.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const tempColor = new THREE.Color();

    const animate = () => {
      if (!sceneRef.current) return;
      const { renderer, scene, camera, particles, trailParticles, star, pointLight } = sceneRef.current;
      const hand = stateRef.current;

      // React to rotation: Speed up tree and increase glow
      // Sensitive threshold for rotation
      const isRotating = hand.rotationSpeed > 0.015;
      const targetSpeed = isRotating ? 0.045 : (hand.isOpen ? 0.015 : 0.002);
      const targetGlow = isRotating ? 3.0 : 0.5;
      
      sceneRef.current.currentSpeed = lerp(sceneRef.current.currentSpeed, targetSpeed, 0.05);
      sceneRef.current.currentGlow = lerp(sceneRef.current.currentGlow, targetGlow, 0.03);
      
      particles.rotation.y += sceneRef.current.currentSpeed;
      pointLight.intensity = sceneRef.current.currentGlow;
      star.rotation.y += sceneRef.current.currentSpeed * 2;
      (star.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 + sceneRef.current.currentGlow;

      // Update tree scale smoothly based on pinch
      const targetScale = hand.isOpen ? 1.0 : 0.6;
      sceneRef.current.currentSize = lerp(sceneRef.current.currentSize, targetScale, 0.05);
      particles.scale.setScalar(sceneRef.current.currentSize);
      star.scale.setScalar(sceneRef.current.currentSize);
      star.position.y = (treeHeight / 2 + 0.3) * sceneRef.current.currentSize;

      // Trail Update Logic
      const trailPosAttr = trailParticles.geometry.attributes.position;
      const trailLifeAttr = trailParticles.geometry.attributes.life as THREE.BufferAttribute;
      const trailColorAttr = trailParticles.geometry.attributes.color;
      
      // Decay trail
      for (let i = 0; i < trailCount; i++) {
        if (trailLifeAttr.array[i] > 0) {
          trailLifeAttr.array[i] -= 0.012; 
          if (trailLifeAttr.array[i] < 0) trailLifeAttr.array[i] = 0;
        }
      }

      // Emit when moving
      if (hand.active && hand.rotationSpeed > 0.01) {
        const emissionRate = Math.min(30, Math.floor(hand.rotationSpeed * 150));
        for (let j = 0; j < emissionRate; j++) {
          sceneRef.current.trailTheta += 0.18; 
          sceneRef.current.trailY = (sceneRef.current.trailY + 0.06) % treeHeight;
          
          const y = sceneRef.current.trailY - treeHeight / 2;
          const r = (1 - (sceneRef.current.trailY / treeHeight)) * baseRadius + 0.2;
          const x = Math.cos(sceneRef.current.trailTheta) * r;
          const z = Math.sin(sceneRef.current.trailTheta) * r;

          const index = sceneRef.current.trailActivePoints % trailCount;
          trailPosAttr.setXYZ(index, x * sceneRef.current.currentSize, y * sceneRef.current.currentSize, z * sceneRef.current.currentSize);
          
          const hueOffset = hand.isOpen ? 0.0 : 0.6;
          const hue = (sceneRef.current.trailTheta * 0.05 + hueOffset) % 1.0;
          tempColor.setHSL(hue, 0.9, 0.6);
          
          trailColorAttr.setXYZ(index, tempColor.r, tempColor.g, tempColor.b);
          trailLifeAttr.array[index] = 1.0;
          sceneRef.current.trailActivePoints++;
        }
      }

      trailPosAttr.needsUpdate = true;
      trailLifeAttr.needsUpdate = true;
      trailColorAttr.needsUpdate = true;

      // Tree Twinkle logic
      const colorsAttr = particles.geometry.attributes.color;
      const time = Date.now() * 0.005;
      for (let i = 0; i < particleCount; i++) {
        const twinkle = Math.sin(time + i) * 0.5 + 0.5;
        const boost = isRotating ? 1.6 : 1.0;
        
        if (hand.isOpen) {
          const variant = i % 3;
          if (variant === 0) colorsAttr.setXYZ(i, 1 * boost, 0.8 * twinkle, 0.2); 
          else if (variant === 1) colorsAttr.setXYZ(i, 1 * twinkle, 0.1, 0.1);
          else colorsAttr.setXYZ(i, 0.2, 0.9 * twinkle, 0.2);
        } else {
          const variant = i % 2;
          if (variant === 0) colorsAttr.setXYZ(i, 0.1, 0.3 * twinkle, 1 * boost);
          else colorsAttr.setXYZ(i, 0.8 * twinkle, 0.9, 1);
        }
      }
      colorsAttr.needsUpdate = true;

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      renderer.dispose();
      hands.close();
      camera.stop();
      if (previewContainer) {
        previewContainer.innerHTML = '';
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default Experience;
