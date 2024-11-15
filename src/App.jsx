import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import Scene from "./components/Scene";
import Camera from "./components/Camera";
import Lights from "./components/Lights";
import StatsComponent from "./components/Stats";
import "./App.css";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const GRAVITY = 30;
const STEPS_PER_FRAME = 5;
const playerVelocity = new THREE.Vector3();
const keyStates = {};

const App = () => {

  const [score, setScore] = useState(0); // Puntaje del jugador
  const [timeLeft, setTimeLeft] = useState(300); // Tiempo restante en segundos (5 min)
  const [gameOver, setGameOver] = useState(false); // Estado del juego terminado
  
  const containerRef = useRef(null);
  const rendererRef = useRef(null); // Renderer will be initialized here
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(
    new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
  );
  const clock = new THREE.Clock();
  const worldOctree = useRef(new Octree());
  const playerCollider = useRef(
    new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35)
  );
  const playerOnFloorRef = useRef(false);
  const animationRef = useRef();
  const ballsRef = useRef([]);

  const enemiesRef = useRef([]);
  const ENEMY_SPAWN_INTERVAL = 5; // Tiempo entre spawns (segundos)
  const ENEMY_SPEED = 2; // Velocidad de los enemigos

  const onTouchMove = (event) => {
    if (document.pointerLockElement === containerRef.current) {
      // Ajustar la sensibilidad según tu necesidad
      const touchSensitivity = 0.005;
      cameraRef.current.rotation.y -= event.touches[0].pageX * touchSensitivity;
      cameraRef.current.rotation.x -= event.touches[0].pageY * touchSensitivity;
    }
  };

  useEffect(() => {
    if (timeLeft > 0 && !gameOver) {
      const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft <= 0) {
      setGameOver(true);
    }
  }, [timeLeft, gameOver]);

  // Load collision world
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load("./models/collision-world.glb", (gltf) => {
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
    // Inicializar renderer si no está creado aún
    if (!rendererRef.current) {
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      rendererRef.current.setPixelRatio(window.devicePixelRatio);
      containerRef.current.appendChild(rendererRef.current.domElement);
    }

    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    camera.rotation.order = "YXZ";

    // Listener para movimiento del mouse
    const onMouseMove = (event) => {
      if (document.pointerLockElement === containerRef.current) {
        camera.rotation.y -= event.movementX / 500;
        camera.rotation.x -= event.movementY / 500;
      }
    };

    // Listener para movimiento de toque en pantalla
    const onTouchMove = (event) => {
      if (document.pointerLockElement === containerRef.current) {
        const touchSensitivity = 0.005;
        camera.rotation.y -= event.touches[0].pageX * touchSensitivity;
        camera.rotation.x -= event.touches[0].pageY * touchSensitivity;
      }
    };

    // Listener para el clic para bloquear el puntero
    containerRef.current.addEventListener("mousedown", () => {
      containerRef.current.requestPointerLock();
    });

    // Agregar los listeners de eventos
    document.addEventListener("mousemove", onMouseMove);
    containerRef.current.addEventListener("touchmove", onTouchMove);

    // Listeners para las teclas
    const onKeyDown = (event) => {
      keyStates[event.code] = true;
    };

    const onKeyUp = (event) => {
      keyStates[event.code] = false;
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    // Función de animación
    const GRAVITY = 10; // Ya definido
    const REBOUND_DAMPING = 0.8; // Factor de reducción de velocidad tras el rebote

    const updateBalls = (deltaTime) => {
      ballsRef.current = ballsRef.current.filter(({ mesh, velocity }) => {
        velocity.y -= GRAVITY * deltaTime; // Aplicar gravedad
        mesh.position.addScaledVector(velocity, deltaTime); // Actualizar posición de la pelota
    
        const collisionResult = worldOctree.current.sphereIntersect(new THREE.Sphere(mesh.position, 0.2));
        if (collisionResult) {
          velocity.addScaledVector(collisionResult.normal, -2 * velocity.dot(collisionResult.normal));
          velocity.multiplyScalar(REBOUND_DAMPING);
          mesh.position.addScaledVector(collisionResult.normal, collisionResult.depth);
        }
    
        // Verificar colisión con enemigos
        enemiesRef.current = enemiesRef.current.filter(({ mesh: enemyMesh }) => {
          const distance = mesh.position.distanceTo(enemyMesh.position);
          if (distance < 0.5) {
            setScore(prevScore => prevScore + 10); // Incrementar puntaje // Incrementar puntaje
            sceneRef.current.remove(enemyMesh); // Eliminar enemigo
            return false;
          }
          return true;
        });
    
        // Eliminar la pelota si está fuera de rango
        if (mesh.position.length() > 100) {
          sceneRef.current.remove(mesh);
          return false;
        }
    
        return true;
      });
    };
    
    

    const updateEnemies = (deltaTime) => {
      const playerPosition = cameraRef.current.position;
    
      enemiesRef.current.forEach(({ mesh }) => {
        const direction = new THREE.Vector3();
        direction.subVectors(playerPosition, mesh.position).normalize();
    
        mesh.position.addScaledVector(direction, ENEMY_SPEED * deltaTime); // Mover enemigo hacia el jugador
    
        // Verificar si el enemigo alcanzó al jugador
        const distance = mesh.position.distanceTo(playerPosition);
        if (distance < 1.0) {
          setScore(prevScore => Math.max(prevScore - 4, 0)); // Reducir puntaje sin permitir valores negativos
          sceneRef.current.remove(mesh); // Eliminar enemigo alcanzado
        }
      });
    };
    

    const animate = () => {
      const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

      for (let i = 0; i < STEPS_PER_FRAME; i++) {
        controls(deltaTime);
        updatePlayer(deltaTime);
        updateBalls(deltaTime); // Llama a la actualización de las pelotas
        updateEnemies(deltaTime);
        teleportPlayerIfOob();
      }

      renderer.render(sceneRef.current, cameraRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Manejo de pérdida de contexto WebGL
    const handleContextLoss = (event) => {
      event.preventDefault();
      console.warn("WebGL context lost");
      cancelAnimationFrame(animationRef.current);
    };

    const handleContextRestored = () => {
      console.warn("WebGL context restored");
      animate();
    };

    renderer.domElement.addEventListener("webglcontextlost", handleContextLoss);
    renderer.domElement.addEventListener(
      "webglcontextrestored",
      handleContextRestored
    );

    // Limpiar listeners al desmontar el componente
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      containerRef.current.removeEventListener("touchmove", onTouchMove);
      renderer.dispose();
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    const onClick = () => shootBall();
    document.addEventListener("click", onClick);

    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const spawnEnemy = () => {
      const enemyGeometry = new THREE.SphereGeometry(0.3, 16, 16); // Tamaño del muñeco
      const enemyMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
      });
      const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
      enemy.castShadow = true;

      // Generar el enemigo en una posición aleatoria dentro de un rango
      const spawnRange = 20;
      enemy.position.set(
        (Math.random() - 0.5) * spawnRange,
        1, // Altura inicial
        (Math.random() - 0.5) * spawnRange
      );

      // Agregar al array y a la escena
      enemiesRef.current.push({ mesh: enemy, velocity: new THREE.Vector3() });
      sceneRef.current.add(enemy);
    };

    // Crear un intervalo para spawnear enemigos
    const intervalId = setInterval(spawnEnemy, ENEMY_SPAWN_INTERVAL * 1000);

    // Limpiar el intervalo al desmontar
    return () => clearInterval(intervalId);
  }, []);

  const controls = (deltaTime) => {
    const speedDelta = deltaTime * (playerOnFloorRef.current ? 25 : 8);
    const forwardVector = new THREE.Vector3();
    const sideVector = new THREE.Vector3();

    // Actualiza el vector de movimiento con la dirección de la cámara
    getForwardVector(cameraRef.current, forwardVector).multiplyScalar(
      (keyStates["KeyW"] ? 1 : 0) - (keyStates["KeyS"] ? 1 : 0)
    );
    getSideVector(cameraRef.current, sideVector).multiplyScalar(
      (keyStates["KeyD"] ? 1 : 0) - (keyStates["KeyA"] ? 1 : 0)
    );

    const combinedDirection = new THREE.Vector3()
      .addVectors(forwardVector, sideVector)
      .normalize()
      .multiplyScalar(speedDelta);

    playerVelocity.add(combinedDirection);

    if (playerOnFloorRef.current && keyStates["Space"]) {
      playerVelocity.y = 15;
    }
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

    const collisionResult = worldOctree.current.capsuleIntersect(
      playerCollider.current
    );
    playerOnFloorRef.current = false;
    if (collisionResult) {
      playerOnFloorRef.current = collisionResult.normal.y > 0;
      playerVelocity.addScaledVector(
        collisionResult.normal,
        -collisionResult.normal.dot(playerVelocity)
      );
      playerCollider.current.translate(
        collisionResult.normal.multiplyScalar(collisionResult.depth)
      );
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

  const shootBall = () => {
    const ballGeometry = new THREE.SphereGeometry(0.2, 16, 16); // Tamaño de la pelota
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;

    // Posicionar la pelota cerca de la cámara
    ball.position.copy(cameraRef.current.position);

    // Calcular la dirección en la que disparar
    const direction = new THREE.Vector3();
    cameraRef.current.getWorldDirection(direction);

    // Guardar la pelota y su velocidad
    ballsRef.current.push({
      mesh: ball,
      velocity: direction.multiplyScalar(10), // Velocidad de la pelota
    });

    sceneRef.current.add(ball);
  };

  return (
    <div ref={containerRef} id="container">
      <div className="hud">
        <p>Score: {score}</p>
        <p>Time Left: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</p>
      </div>
      {gameOver && (
        <div className="game-over">
          <h1>Game Over</h1>
          <p>Your Score: {score}</p>
        </div>
      )}
      <Scene scene={sceneRef.current} />
      <Camera renderer={rendererRef.current} scene={sceneRef.current} camera={cameraRef.current} />
      <Lights scene={sceneRef.current} />
      {/* <StatsComponent container={containerRef.current} /> */}
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
