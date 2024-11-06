import React, { useEffect } from 'react';
import * as THREE from 'three';

const Lights = ({ scene }) => {
  useEffect(() => {
    const fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
    fillLight1.position.set(2, 1, 1);
    scene.add(fillLight1);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(-5, 25, -1);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    return () => {
      scene.remove(fillLight1);
      scene.remove(directionalLight);
    };
  }, [scene]);

  return null;
};

export default Lights;
