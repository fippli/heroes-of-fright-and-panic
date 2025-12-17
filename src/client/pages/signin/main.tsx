import React from "react";
import ReactDOM from "react-dom/client";
import "../../shared/styles/index.css";
import { SigninApp } from "./SigninApp";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SigninApp />
  </React.StrictMode>,
);
