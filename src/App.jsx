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

const GRAVITY = 40;
const STEPS_PER_FRAME = 5;
const playerVelocity = new THREE.Vector3();
const keyStates = {};
const ENEMY_DODGE_SPEED = 20; // Velocidad de esquiva de los enemigos
const ENEMY_THROW_INTERVAL = 5; // Intervalo entre lanzamientos de enemigos
const ENEMY_DODGE_COOLDOWN = 3; // Cooldown time in seconds

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

  useEffect(() => {
    const crosshair = document.createElement("div");
    crosshair.id = "crosshair";
    crosshair.style.position = "absolute";
    crosshair.style.top = "50%";
    crosshair.style.left = "50%";
    crosshair.style.transform = "translate(-50%, -50%)";
    crosshair.style.width = "10px";
    crosshair.style.height = "10px";
    crosshair.style.background = "red";
    crosshair.style.borderRadius = "50%";
    document.body.appendChild(crosshair);

    return () => {
      document.body.removeChild(crosshair);
    };
  }, []);

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
      ballsRef.current = ballsRef.current.filter(({ mesh, velocity, isEnemyBall, origin }) => {
        velocity.y -= GRAVITY * deltaTime; // Apply gravity
        mesh.position.addScaledVector(velocity, deltaTime); // Update position
    
        const collisionResult = worldOctree.current.sphereIntersect(new THREE.Sphere(mesh.position, 0.2));
        if (collisionResult) {
          velocity.addScaledVector(collisionResult.normal, -2 * velocity.dot(collisionResult.normal));
          velocity.multiplyScalar(REBOUND_DAMPING);
          mesh.position.addScaledVector(collisionResult.normal, collisionResult.depth);
        }
    
        // Handle collision with player or enemies
        if (isEnemyBall) {
          const playerDistance = mesh.position.distanceTo(cameraRef.current.position);
          if (playerDistance < 1.0) {
            setScore((prevScore) => Math.max(prevScore - 10, 0)); // Reduce player score
            sceneRef.current.remove(mesh); // Remove the ball
            return false;
          }
        } else {
          // Handle collision with enemies, but ignore the origin
          enemiesRef.current = enemiesRef.current.filter(({ mesh: enemyMesh }) => {
            const distance = mesh.position.distanceTo(enemyMesh.position);
            if (distance < 0.5 && origin !== enemyMesh) {
              setScore((prevScore) => prevScore + 10); // Increment score
              sceneRef.current.remove(enemyMesh); // Remove enemy
              return false;
            }
            return true;
          });
        }
    
        // Remove the ball if out of range
        if (mesh.position.length() > 100) {
          sceneRef.current.remove(mesh);
          return false;
        }
    
        return true;
      });
    };    
    

    const updateEnemies = (deltaTime) => {
      const playerPosition = cameraRef.current.position;
      const currentTime = clock.getElapsedTime();
    
      enemiesRef.current.forEach((enemy, index) => {
        const { mesh, velocity, lastDodge, nextThrow, dangerLevel } = enemy;
    
        // Detect balls heading toward the enemy
        const dangerBalls = ballsRef.current.filter(({ mesh: ballMesh, velocity: ballVelocity }) => {
          const toEnemy = new THREE.Vector3().subVectors(mesh.position, ballMesh.position);
          const dotProduct = toEnemy.dot(ballVelocity.clone().normalize()); // Ball moving toward enemy
          const distance = toEnemy.length();
    
          // Multi-step prediction for ball trajectory
          const ballFuturePosition = ballMesh.position.clone().add(ballVelocity.clone().multiplyScalar(0.5)); // Predict half-second ahead
          const futureDistance = mesh.position.distanceTo(ballFuturePosition);
    
          return dotProduct > 0 && distance < 8 && futureDistance < 2; // Approaching and within danger range
        });
    
        // Adjust danger level for adaptive behavior
        enemy.dangerLevel = Math.min(1, dangerBalls.length / 2); // Scale between 0 (safe) and 1 (high danger)
    
        // Dodging behavior
        if (dangerBalls.length > 0 && currentTime >= (lastDodge || 0) + enemy.dodgeCooldown) {
          const dangerBall = dangerBalls[0];
    
          // Calculate dodge direction and ensure obstacle-free path
          const dodgeDirection = calculateDodgeDirection(mesh, dangerBall);
    
          velocity.add(dodgeDirection.multiplyScalar(
            ENEMY_DODGE_SPEED + Math.random() * 2 + enemy.dangerLevel * 5 // Adjust dodge speed based on danger level
          ));
    
          enemy.lastDodge = currentTime; // Update dodge cooldown
        } else {
          // Gradual stop when not actively dodging
          velocity.multiplyScalar(0.8);
        }
    
        // Strategic movement when not dodging
        if (dangerBalls.length === 0) {
          const directionToPlayer = new THREE.Vector3()
            .subVectors(playerPosition, mesh.position)
            .normalize();
    
          // Add a random offset to prevent linear behavior
          directionToPlayer.x += (Math.random() - 0.5) * 0.5;
          directionToPlayer.z += (Math.random() - 0.5) * 0.5;
    
          mesh.position.addScaledVector(directionToPlayer, ENEMY_SPEED * (1 + enemy.dangerLevel) * deltaTime);
        }
    
        // Throw a ball at the player if cooldown allows
        if (currentTime >= (nextThrow || 0)) {
          throwEnemyBall(mesh.position, predictPlayerPosition(playerPosition), mesh);
          enemy.nextThrow = currentTime + ENEMY_THROW_INTERVAL - enemy.dangerLevel * 2; // Faster throws in high danger
        }
    
        // Update position based on velocity
        mesh.position.addScaledVector(velocity, deltaTime);
      });
    };
    
    // Function to calculate dodge direction using raycasting and obstacle awareness
    const calculateDodgeDirection = (enemyMesh, dangerBall) => {
      const dodgeOptions = [
        new THREE.Vector3(1, 0, 0),  // Right
        new THREE.Vector3(-1, 0, 0), // Left
        new THREE.Vector3(0, 0, 1),  // Forward
        new THREE.Vector3(0, 0, -1), // Backward
      ];
    
      const safeDirections = dodgeOptions.filter((direction) => {
        const raycaster = new THREE.Raycaster(enemyMesh.position, direction);
        const intersections = raycaster.intersectObjects(sceneRef.current.children, true);
        return intersections.length === 0 || intersections[0].distance > 2; // No immediate obstacles
      });
    
      if (safeDirections.length > 0) {
        return safeDirections[Math.floor(Math.random() * safeDirections.length)].normalize(); // Randomize dodge direction
      }
    
      // Default to moving upwards slightly if no safe direction
      return new THREE.Vector3(0, 1, 0).normalize();
    };
    
    // Predict player movement for more accurate enemy throws
    const predictPlayerPosition = (currentPlayerPosition) => {
      const playerVelocity = new THREE.Vector3();
      playerVelocity.copy(cameraRef.current.getWorldDirection(new THREE.Vector3()));
      playerVelocity.multiplyScalar(2); // Assume player is moving at a constant speed
    
      return currentPlayerPosition.clone().add(playerVelocity.multiplyScalar(0.3)); // Predict position slightly ahead
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
      const enemyGeometry = new THREE.SphereGeometry(0.3, 16, 16); // Enemy size
      const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
      enemy.castShadow = true;
  
      // Generate random spawn position
      const spawnRange = 20;
      enemy.position.set(
        (Math.random() - 0.5) * spawnRange,
        1,
        (Math.random() - 0.5) * spawnRange
      );
  
      // Add to enemies list with randomized dodge cooldown and speed
      enemiesRef.current.push({
        mesh: enemy,
        velocity: new THREE.Vector3(),
        nextThrow: clock.getElapsedTime() + ENEMY_THROW_INTERVAL, // Initial throw timer
        lastDodge: 0, // Initialize dodge cooldown timer
        dodgeCooldown: ENEMY_DODGE_COOLDOWN + Math.random() * 1.5, // Random dodge cooldown
      });
  
      sceneRef.current.add(enemy);
    };
  
    // Create interval for spawning enemies
    const intervalId = setInterval(spawnEnemy, ENEMY_SPAWN_INTERVAL * 1000);
  
    // Clear interval on unmount
    return () => clearInterval(intervalId);
  }, []);
  

  useEffect(() => {
    const scalingInterval = setInterval(() => {
      ENEMY_SPAWN_INTERVAL = Math.max(ENEMY_SPAWN_INTERVAL - 0.5, 2); // Faster spawns
      ENEMY_DODGE_COOLDOWN = Math.max(ENEMY_DODGE_COOLDOWN - 0.2, 0.5); // Faster dodges
      ENEMY_DODGE_SPEED += 0.3; // Increase dodge speed
      ENEMY_SPEED += 0.2; // Faster movement speed
    }, 30000); // Scale every 30 seconds
  
    return () => clearInterval(scalingInterval);
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

  const throwEnemyBall = (enemyPosition, targetPosition, originMesh) => {
    const ballGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;
    ball.position.copy(enemyPosition);
  
    // Calculate direction toward the player
    const velocity = new THREE.Vector3()
      .subVectors(targetPosition, enemyPosition)
      .normalize()
      .multiplyScalar(10); // Adjust speed if needed
  
    ballsRef.current.push({
      mesh: ball,
      velocity,
      isEnemyBall: true, // Mark as enemy ball
      origin: originMesh, // Reference to the enemy that threw the ball
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
