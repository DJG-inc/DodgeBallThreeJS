import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AudioProvider } from "./context/AudioProvider";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <AudioProvider>
    <App />
  </AudioProvider>
);
