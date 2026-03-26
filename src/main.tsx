import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Prevent window close from destroying the window — hide to tray instead
const win = getCurrentWindow();
win.onCloseRequested(async (event) => {
  event.preventDefault();
  await win.hide();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
