import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { registerParentSW } from "./push";
import "./styles.css";

void registerParentSW().catch(() => undefined);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/parent">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
