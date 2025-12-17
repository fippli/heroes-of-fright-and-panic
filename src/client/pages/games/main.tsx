import React from "react";
import ReactDOM from "react-dom/client";
import "../../shared/styles/index.css";
import { GamesApp } from "./GamesApp";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <GamesApp />
  </React.StrictMode>,
);
