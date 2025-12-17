import React from "react";
import ReactDOM from "react-dom/client";
import "../../shared/styles/index.css";
import { LandingApp } from "./LandingApp";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LandingApp />
  </React.StrictMode>,
);
