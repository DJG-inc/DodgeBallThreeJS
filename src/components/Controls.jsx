import React, { useEffect } from 'react';

const Controls = ({ keyStates }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      keyStates[event.code] = true;
    };

    const handleKeyUp = (event) => {
      keyStates[event.code] = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [keyStates]);

  return null; // No UI to render
};

export default Controls;
