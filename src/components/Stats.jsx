import React, { useEffect } from 'react';
import Stats from 'three/addons/libs/stats.module.js';

const StatsComponent = ({ container }) => {
  useEffect(() => {
    if (!container) return; // Exit if container is not yet available

    const stats = new Stats();
    container.appendChild(stats.dom);

    const animate = () => {
      stats.update();
      requestAnimationFrame(animate);
    };

    animate();

    // Clean up when the component is unmounted
    return () => {
      if (container && stats.dom) container.removeChild(stats.dom);
    };
  }, [container]);

  return null;
};

export default StatsComponent;
