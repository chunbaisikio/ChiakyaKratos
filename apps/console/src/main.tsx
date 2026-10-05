import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./app-theme.css";
import App from "./App.tsx";
import LegacyRedirect from "./components/LegacyRedirect";

const legacyRoutes: Record<string, string> = {
  "/editor": "/posts",
  "/albums": "/albums",
  "/games": "/games",
};
const oldPath = window.location.hash.slice(1).split("?")[0].replace(/\/$/, "");
const destination = legacyRoutes[oldPath];
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {destination ? <LegacyRedirect destination={destination} /> : <App />}
  </StrictMode>,
);
