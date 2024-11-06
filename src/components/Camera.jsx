import React, { useEffect } from 'react';

const Camera = ({ renderer, scene, camera }) => {
  useEffect(() => {
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, [camera, scene, renderer]);

  return null;
};

export default Camera;
