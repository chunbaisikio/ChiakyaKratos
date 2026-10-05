import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "../app-theme.css";
import SiteAdminApp from "./SiteAdminApp";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SiteAdminApp />
  </StrictMode>,
);
