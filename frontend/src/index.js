// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";
import "./i18n";

// Optional: init Google Analytics later
// import ReactGA from "react-ga4";
// ReactGA.initialize("G-XXXXXXXXXX");
// ReactGA.send("pageview");

const root = createRoot(document.getElementById("root"));
root.render(<App />);
