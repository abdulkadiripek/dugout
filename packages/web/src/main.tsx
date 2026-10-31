import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/tokens.css";
import "./styles/base.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
