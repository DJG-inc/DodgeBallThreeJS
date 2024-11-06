import React, { useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';

const Scene = ({ scene }) => {
  useEffect(() => {
    // Set a more neutral background color to avoid blue dominance
    scene.background = new THREE.Color(0xa0a0a0); // Light gray background
    scene.fog = new THREE.Fog(0xa0a0a0, 10, 50); // Adjusted fog to match background

    // Initialize lights in the scene
    const fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
    fillLight1.position.set(2, 1, 1);
    scene.add(fillLight1);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(-5, 25, -1);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.01;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.radius = 4;
    directionalLight.shadow.bias = -0.00006;
    scene.add(directionalLight);

    // Load GLTF model  
    const loader = new GLTFLoader();
    const worldOctree = new Octree();
    loader.load('./models/collision-world.glb', (gltf) => {
      scene.add(gltf.scene);
      worldOctree.fromGraphNode(gltf.scene);

      // Enable shadows on each mesh
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material.map) {
            child.material.map.anisotropy = 4;
          }
        }
      });

      // Add octree helper for debugging
      const helper = new OctreeHelper(worldOctree);
      helper.visible = false;
      scene.add(helper);
    });

    // Clean up when the component unmounts
    return () => {
      scene.remove(fillLight1);
      scene.remove(directionalLight);
    };
  }, [scene]);

  return null;
};

export default Scene;
