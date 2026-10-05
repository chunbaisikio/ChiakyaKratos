import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "../app-theme.css";
import FF14AdminApp from "./FF14AdminApp";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FF14AdminApp />
  </StrictMode>,
);
