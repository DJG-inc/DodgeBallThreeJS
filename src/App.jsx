import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import Scene from "./components/Scene";
import Camera from "./components/Camera";
import Lights from "./components/Lights";
import "./App.css";
import { Octree } from "three/examples/jsm/math/Octree.js";
import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const GRAVITY = 40;
const STEPS_PER_FRAME = 5;
let ENEMY_SPAWN_INTERVAL = 5;
let ENEMY_SPEED = 2;
let ENEMY_THROW_INTERVAL = 5;
let ENEMY_DODGE_COOLDOWN = 3;
let ENEMY_DODGE_SPEED = 5;
const CHARGE_TIME = 3; // Maximum charge time in seconds

const App = () => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300);
  const [gameOver, setGameOver] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [lockOnTarget, setLockOnTarget] = useState(null);

  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(
    new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
  );
  const clock = useRef(new THREE.Clock());
  const worldOctree = useRef(new Octree());
  const playerCollider = useRef(
    new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35)
  );
  const playerOnFloorRef = useRef(false);
  const animationRef = useRef();
  const ballsRef = useRef([]);
  const enemiesRef = useRef([]);
  const keyStates = {};
  const playerVelocity = useRef(new THREE.Vector3());

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

  useEffect(() => {
    // Crear el objeto de audio
    const soundtrack = new Audio("./music/soundtrack.mp3");
    soundtrack.loop = true; // Reproducir en bucle
    soundtrack.volume = 1; // Ajustar el volumen (opcional)
    soundtrack.play(); // Iniciar la reproducción
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && !gameOver) {
      const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft <= 0) {
      setGameOver(true);
    }
  }, [timeLeft, gameOver]);

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
    if (!rendererRef.current) {
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      rendererRef.current.setPixelRatio(window.devicePixelRatio);
      containerRef.current.appendChild(rendererRef.current.domElement);
    }

    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    camera.rotation.order = "YXZ";

    const onMouseMove = (event) => {
      if (document.pointerLockElement === containerRef.current) {
        camera.rotation.y -= event.movementX / 500;
        camera.rotation.x -= event.movementY / 500;
      }
    };

    containerRef.current.addEventListener("click", () => {
      containerRef.current.requestPointerLock();
    });

    document.addEventListener("mousemove", onMouseMove);

    const onKeyDown = (event) => {
      keyStates[event.code] = true;
    };

    const onKeyUp = (event) => {
      keyStates[event.code] = false;
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    const animate = () => {
      const deltaTime =
        Math.min(0.05, clock.current.getDelta()) / STEPS_PER_FRAME;

      for (let i = 0; i < STEPS_PER_FRAME; i++) {
        controls(deltaTime);
        updatePlayer(deltaTime);
        updateBalls(deltaTime);
        updateEnemies(deltaTime);
        teleportPlayerIfOob();
      }

      renderer.render(sceneRef.current, cameraRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

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

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      renderer.dispose();
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    const onMouseDown = () => {
      setIsCharging(true);
      setChargeLevel(0);
    };

    const onMouseUp = () => {
      setIsCharging(false);
      shootBall();
      setChargeLevel(0);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    let chargeInterval;
    if (isCharging) {
      chargeInterval = setInterval(() => {
        setChargeLevel((prev) => Math.min(prev + 0.02, 1));
      }, (CHARGE_TIME * 1000) / 50); // Adjusted for smoother charging
    } else {
      clearInterval(chargeInterval);
    }

    return () => clearInterval(chargeInterval);
  }, [isCharging]);

  useEffect(() => {
    if (isCharging) {
      const cameraDirection = new THREE.Vector3();
      cameraRef.current.getWorldDirection(cameraDirection);

      let minAngle = Infinity;
      let closestEnemy = null;

      enemiesRef.current.forEach((enemy) => {
        const enemyDirection = new THREE.Vector3()
          .subVectors(enemy.mesh.position, cameraRef.current.position)
          .normalize();
        const angle = cameraDirection.angleTo(enemyDirection) * (180 / Math.PI);

        if (angle < 11 && angle < minAngle) {
          minAngle = angle;
          closestEnemy = enemy;
        }
      });

      if (closestEnemy) {
        setLockOnTarget(closestEnemy);
      } else {
        setLockOnTarget(null);
      }
    } else {
      setLockOnTarget(null);
    }
  }, [isCharging, chargeLevel]);

  useEffect(() => {
    if (lockOnTarget && lockOnTarget.mesh) {
      if (!lockOnTarget.selectionRing) {
        const ringGeometry = new THREE.RingGeometry(0.4, 0.5, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0xffff00,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
        ringMesh.rotation.x = -Math.PI / 2;
        lockOnTarget.mesh.add(ringMesh);
        lockOnTarget.selectionRing = ringMesh;
      }
    }

    enemiesRef.current.forEach((enemy) => {
      if (enemy !== lockOnTarget && enemy.selectionRing) {
        enemy.mesh.remove(enemy.selectionRing);
        delete enemy.selectionRing;
      }
    });
  }, [lockOnTarget]);

  useEffect(() => {
    const spawnEnemy = () => {
      const enemyGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
      enemy.castShadow = true;

      const spawnRange = 20;
      enemy.position.set(
        (Math.random() - 0.5) * spawnRange,
        1,
        (Math.random() - 0.5) * spawnRange
      );

      enemiesRef.current.push({
        mesh: enemy,
        velocity: new THREE.Vector3(),
        nextThrow: clock.current.getElapsedTime() + ENEMY_THROW_INTERVAL,
        lastDodge: 0,
        dodgeCooldown: ENEMY_DODGE_COOLDOWN + Math.random() * 1.5,
        hasBall: false,
      });

      sceneRef.current.add(enemy);
    };

    const intervalId = setInterval(spawnEnemy, ENEMY_SPAWN_INTERVAL * 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const scalingInterval = setInterval(() => {
      ENEMY_SPAWN_INTERVAL = Math.max(ENEMY_SPAWN_INTERVAL - 0.5, 2);
      ENEMY_DODGE_COOLDOWN = Math.max(ENEMY_DODGE_COOLDOWN - 0.2, 0.5);
      ENEMY_DODGE_SPEED += 0.3;
      ENEMY_SPEED += 0.2;
    }, 30000);

    return () => clearInterval(scalingInterval);
  }, []);

  const controls = (deltaTime) => {
    const speedDelta = deltaTime * (playerOnFloorRef.current ? 25 : 8);
    const forwardVector = new THREE.Vector3();
    const sideVector = new THREE.Vector3();

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

    playerVelocity.current.add(combinedDirection);

    if (playerOnFloorRef.current && keyStates["Space"]) {
      playerVelocity.current.y = 15;
    }
  };

  const updatePlayer = (deltaTime) => {
    let damping = Math.exp(-4 * deltaTime) - 1;
    if (!playerOnFloorRef.current) {
      playerVelocity.current.y -= GRAVITY * deltaTime;
      damping *= 0.1;
    }
    playerVelocity.current.addScaledVector(playerVelocity.current, damping);

    const deltaPosition = playerVelocity.current
      .clone()
      .multiplyScalar(deltaTime);
    playerCollider.current.translate(deltaPosition);

    const collisionResult = worldOctree.current.capsuleIntersect(
      playerCollider.current
    );
    playerOnFloorRef.current = false;
    if (collisionResult) {
      playerOnFloorRef.current = collisionResult.normal.y > 0;
      playerVelocity.current.addScaledVector(
        collisionResult.normal,
        -collisionResult.normal.dot(playerVelocity.current)
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
      playerVelocity.current.set(0, 0, 0);
      cameraRef.current.position.copy(playerCollider.current.end);
    }
  };

  const shootBall = () => {
    const ballGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;

    ball.position.copy(cameraRef.current.position);

    let direction = new THREE.Vector3();
    cameraRef.current.getWorldDirection(direction);

    let target = null;

    if (lockOnTarget && lockOnTarget.mesh) {
      target = lockOnTarget.mesh;
    }

    const minSpeed = 20;
    const maxSpeed = 50;
    const speed = minSpeed + (maxSpeed - minSpeed) * chargeLevel;

    ballsRef.current.push({
      mesh: ball,
      velocity: direction.multiplyScalar(speed),
      isEnemyBall: false,
      origin: null,
      isCollectible: false,
      target, // Set the target for homing behavior
      hasCollided: false, // Flag to check if ball has collided
    });

    sceneRef.current.add(ball);
  };

  const updateBalls = (deltaTime) => {
    ballsRef.current = ballsRef.current.filter((ball) => {
      const {
        mesh,
        velocity,
        isEnemyBall,
        origin,
        isCollectible,
        target,
        hasCollided,
      } = ball;

      if (!isCollectible) {
        if (target && !hasCollided) {
          // Homing behavior
          const targetPosition = target.position.clone();
          const directionToTarget = targetPosition
            .sub(mesh.position)
            .normalize();

          // Gradually adjust velocity towards the target
          velocity.lerp(
            directionToTarget.multiplyScalar(velocity.length()),
            0.05
          );
        } else if (isEnemyBall && !hasCollided) {
          // Enemy balls home towards the player
          const playerPosition = cameraRef.current.position.clone();
          const directionToPlayer = playerPosition
            .sub(mesh.position)
            .normalize();
          velocity.lerp(
            directionToPlayer.multiplyScalar(velocity.length()),
            0.02
          );
        }

        velocity.y -= GRAVITY * deltaTime;
        mesh.position.addScaledVector(velocity, deltaTime);
      }

      const collisionResult = worldOctree.current.sphereIntersect(
        new THREE.Sphere(mesh.position, 0.2)
      );
      if (collisionResult) {
        if (!isCollectible) {
          ball.isCollectible = true;
          ball.hasCollided = true;
          mesh.material.color.set(0x00ffff);
          mesh.material.emissive = new THREE.Color(0x00ffff);
          mesh.material.emissiveIntensity = 1;

          // Reproducir sonido al colisionar
          const collisionSound = new Audio("./music/dodgeball.mp3");
          collisionSound.play();

          // Apply friction and bounce
          const normal = collisionResult.normal.clone();
          const velocityDotNormal = velocity.dot(normal);
          velocity.addScaledVector(normal, -2 * velocityDotNormal);
          velocity.multiplyScalar(0.5); // Reduce speed after collision
          velocity.y = 0; // Stop vertical movement
          mesh.position.addScaledVector(
            collisionResult.normal,
            collisionResult.depth
          );
        }
      }

      if (ball.isCollectible) {
        const playerDistance = mesh.position.distanceTo(
          cameraRef.current.position
        );
        if (playerDistance < 1.0) {
          sceneRef.current.remove(mesh);
          return false;
        }

        enemiesRef.current.forEach((enemy) => {
          const enemyDistance = mesh.position.distanceTo(enemy.mesh.position);
          if (enemyDistance < 1.0 && !enemy.hasBall) {
            sceneRef.current.remove(mesh);
            enemy.hasBall = true;
            return;
          }
        });
      } else {
        if (isEnemyBall && !hasCollided) {
          const playerDistance = mesh.position.distanceTo(
            cameraRef.current.position
          );
          if (playerDistance < 1.0) {
            setScore((prevScore) => Math.max(prevScore - 10, 0));
            ball.isCollectible = true;
            ball.hasCollided = true;
            ball.velocity.set(0, 0, 0);
            mesh.material.color.set(0x00ffff);
            mesh.material.emissive = new THREE.Color(0x00ffff);
            mesh.material.emissiveIntensity = 1;

            // Reproducir sonido en colisión con el jugador
            const collisionSound = new Audio("./music/dodgeball.mp3");
            collisionSound.play();
          }
        } else if (!isEnemyBall && !hasCollided) {
          for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
            const enemy = enemiesRef.current[i];
            const distance = mesh.position.distanceTo(enemy.mesh.position);
            if (distance < 0.5) {
              setScore((prevScore) => prevScore + 10);
              sceneRef.current.remove(enemy.mesh);
              enemiesRef.current.splice(i, 1);
              if (enemy.selectionRing) {
                enemy.mesh.remove(enemy.selectionRing);
              }
              ball.isCollectible = true;
              ball.hasCollided = true;
              ball.velocity.set(0, 0, 0);
              mesh.material.color.set(0x00ffff);
              mesh.material.emissive = new THREE.Color(0x00ffff);
              mesh.material.emissiveIntensity = 1;

              // Reproducir sonido en colisión con el enemigo
              const collisionSound = new Audio("./music/dodgeball.mp3");
              collisionSound.play();
              break;
            }
          }
        }
      }

      if (mesh.position.length() > 100) {
        sceneRef.current.remove(mesh);
        return false;
      }

      return true;
    });
  };

  const updateEnemies = (deltaTime) => {
    const playerPosition = cameraRef.current.position;
    const currentTime = clock.current.getElapsedTime();

    enemiesRef.current.forEach((enemy) => {
      const { mesh } = enemy;

      if (!enemy.hasBall) {
        let nearestBall = null;
        let minDistance = Infinity;
        ballsRef.current.forEach((ball) => {
          if (ball.isCollectible) {
            const distance = mesh.position.distanceTo(ball.mesh.position);
            if (distance < minDistance) {
              minDistance = distance;
              nearestBall = ball;
            }
          }
        });

        if (nearestBall) {
          const directionToBall = new THREE.Vector3()
            .subVectors(nearestBall.mesh.position, mesh.position)
            .normalize();
          mesh.position.addScaledVector(
            directionToBall,
            ENEMY_SPEED * deltaTime
          );

          if (minDistance < 1.0) {
            enemy.hasBall = true;
            sceneRef.current.remove(nearestBall.mesh);
            ballsRef.current = ballsRef.current.filter(
              (ball) => ball !== nearestBall
            );
          }
        } else {
          const directionToPlayer = new THREE.Vector3()
            .subVectors(playerPosition, mesh.position)
            .normalize();
          mesh.position.addScaledVector(
            directionToPlayer,
            ENEMY_SPEED * deltaTime
          );
        }
      } else {
        if (currentTime >= (enemy.nextThrow || 0)) {
          throwEnemyBall(mesh.position, playerPosition, mesh);
          enemy.nextThrow = currentTime + ENEMY_THROW_INTERVAL;
          enemy.hasBall = false;
        }

        const directionToPlayer = new THREE.Vector3()
          .subVectors(playerPosition, mesh.position)
          .normalize();
        mesh.position.addScaledVector(
          directionToPlayer,
          ENEMY_SPEED * deltaTime
        );
      }
    });
  };

  const throwEnemyBall = (enemyPosition, targetPosition, originMesh) => {
    const ballGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;
    ball.position.copy(enemyPosition);

    const velocity = new THREE.Vector3()
      .subVectors(targetPosition, enemyPosition)
      .normalize()
      .multiplyScalar(15);

    ballsRef.current.push({
      mesh: ball,
      velocity,
      isEnemyBall: true,
      origin: originMesh,
      isCollectible: false,
      target: cameraRef.current, // Enemy balls home towards the player
      hasCollided: false,
    });

    sceneRef.current.add(ball);
  };

  return (
    <div ref={containerRef} id="container">
      <div className="hud">
        <p>Score: {score}</p>
        <p>
          Time Left: {Math.floor(timeLeft / 60)}:
          {String(timeLeft % 60).padStart(2, "0")}
        </p>
      </div>
      {isCharging && (
        <div className="charge-bar">
          <div
            className="charge-level"
            style={{ width: `${chargeLevel * 100}%` }}
          ></div>
        </div>
      )}
      {gameOver && (
        <div className="game-over">
          <h1>Game Over</h1>
          <p>Your Score: {score}</p>
        </div>
      )}
      <Scene scene={sceneRef.current} />
      <Camera
        renderer={rendererRef.current}
        scene={sceneRef.current}
        camera={cameraRef.current}
      />
      <Lights scene={sceneRef.current} />
    </div>
  );
};

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
