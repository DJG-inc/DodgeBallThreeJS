import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import Scene from './components/Scene';
import Camera from './components/Camera';
import Lights from './components/Lights';
import StatsComponent from './components/Stats';
import './App.css';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const GRAVITY = 30;
const STEPS_PER_FRAME = 5;
const playerVelocity = new THREE.Vector3();
const keyStates = {};

const App = () => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null); // Renderer will be initialized here
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000));
  const clock = new THREE.Clock();
  const worldOctree = useRef(new Octree());
  const playerCollider = useRef(new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35));
  const playerOnFloorRef = useRef(false);
  const animationRef = useRef();

  // Load collision world
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load('./models/collision-world.glb', (gltf) => {
      sceneRef.current.add(gltf.scene);
      worldOctree.current.fromGraphNode(gltf.scene);
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    });
  }, []);

  useEffect(() => {
    // Initialize renderer only once
    if (!rendererRef.current) {
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      rendererRef.current.setPixelRatio(window.devicePixelRatio);
      containerRef.current.appendChild(rendererRef.current.domElement);
    }
    
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    camera.rotation.order = 'YXZ';

    // Mouse movement listener
    const onMouseMove = (event) => {
      if (document.pointerLockElement === containerRef.current) {
        camera.rotation.y -= event.movementX / 500;
        camera.rotation.x -= event.movementY / 500;
      }
    };
    containerRef.current.addEventListener('mousedown', () => {
      containerRef.current.requestPointerLock();
    });
    document.addEventListener('mousemove', onMouseMove);

    // Key listeners
    document.addEventListener('keydown', (event) => {
      keyStates[event.code] = true;
    });
    document.addEventListener('keyup', (event) => {
      keyStates[event.code] = false;
    });

    const animate = () => {
      const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;
      for (let i = 0; i < STEPS_PER_FRAME; i++) {
        controls(deltaTime);
        updatePlayer(deltaTime);
        teleportPlayerIfOob();
      }
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleContextLoss = (event) => {
      event.preventDefault();
      console.warn('WebGL context lost');
      cancelAnimationFrame(animationRef.current);
    };

    const handleContextRestored = () => {
      console.warn('WebGL context restored');
      animate();
    };

    renderer.domElement.addEventListener('webglcontextlost', handleContextLoss);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      renderer.dispose();
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const controls = (deltaTime) => {
    const speedDelta = deltaTime * (playerOnFloorRef.current ? 25 : 8);
    const playerDirection = new THREE.Vector3();

    if (keyStates['KeyW']) playerVelocity.add(getForwardVector(cameraRef.current, playerDirection).multiplyScalar(speedDelta));
    if (keyStates['KeyS']) playerVelocity.add(getForwardVector(cameraRef.current, playerDirection).multiplyScalar(-speedDelta));
    if (keyStates['KeyA']) playerVelocity.add(getSideVector(cameraRef.current, playerDirection).multiplyScalar(-speedDelta));
    if (keyStates['KeyD']) playerVelocity.add(getSideVector(cameraRef.current, playerDirection).multiplyScalar(speedDelta));
    if (playerOnFloorRef.current && keyStates['Space']) playerVelocity.y = 15;
  };

  const updatePlayer = (deltaTime) => {
    let damping = Math.exp(-4 * deltaTime) - 1;
    if (!playerOnFloorRef.current) {
      playerVelocity.y -= GRAVITY * deltaTime;
      damping *= 0.1;
    }
    playerVelocity.addScaledVector(playerVelocity, damping);

    const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
    playerCollider.current.translate(deltaPosition);

    const collisionResult = worldOctree.current.capsuleIntersect(playerCollider.current);
    playerOnFloorRef.current = false;
    if (collisionResult) {
      playerOnFloorRef.current = collisionResult.normal.y > 0;
      playerVelocity.addScaledVector(collisionResult.normal, -collisionResult.normal.dot(playerVelocity));
      playerCollider.current.translate(collisionResult.normal.multiplyScalar(collisionResult.depth));
    }

    cameraRef.current.position.copy(playerCollider.current.end);
  };

  const teleportPlayerIfOob = () => {
    if (cameraRef.current.position.y <= -25) {
      playerCollider.current.start.set(0, 0.35, 0);
      playerCollider.current.end.set(0, 1, 0);
      playerVelocity.set(0, 0, 0);
      cameraRef.current.position.copy(playerCollider.current.end);
    }
  };

  return (
    <div ref={containerRef} id="container">
      <Scene scene={sceneRef.current} />
      <Camera renderer={rendererRef.current} scene={sceneRef.current} camera={cameraRef.current} />
      <Lights scene={sceneRef.current} />
      <StatsComponent container={containerRef.current} />
    </div>
  );
};

// Helper functions
const getForwardVector = (camera, vector) => {
  camera.getWorldDirection(vector);
  vector.y = 0;
  vector.normalize();
  return vector;
};

const getSideVector = (camera, vector) => {
  camera.getWorldDirection(vector);
  vector.y = 0;
  vector.normalize();
  vector.cross(camera.up);
  return vector;
};

export default App;
