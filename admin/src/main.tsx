import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AdminApp } from "./ui";
import "./styles.css";
import "./dashboard-tables.css";

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><AdminApp /></BrowserRouter></StrictMode>);
