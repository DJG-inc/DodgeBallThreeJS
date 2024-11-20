import React, { createContext, useEffect, useRef } from "react";

const AudioContext = createContext();

export const AudioProvider = ({ children }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) {
      // Crear el audio y configurarlo para loop

      // agrega un evento para qe cuando el jugador haga click empiece a sonar

      document.addEventListener("click", () => {
        audioRef.current.play().catch((err) => console.error("Error al reproducir el audio:", err));
      }
      );

      const soundtrack = new Audio("./music/soundtrack.mp3");
      soundtrack.loop = true;
      soundtrack.volume = 0.3;
      soundtrack.play().catch((err) => console.error("Error al reproducir el audio:", err));
      audioRef.current = soundtrack;
    }
    return () => {
      // Asegurarse de detener y limpiar el audio si es necesario
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <AudioContext.Provider value={audioRef.current}>
      {children}
    </AudioContext.Provider>
  );
};
