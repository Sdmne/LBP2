import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WebApp } from "./ui";
import "./styles.css";
import "./member-profile.css";
import "./member-premium.css";
import "./member-account.css";
import "./member-chat-reference.css";
import "./member-chat.css";
import "./member-tools-reference.css";
import "./member-tools.css";
import "./site-navigation.css";

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><WebApp /></BrowserRouter></StrictMode>);
