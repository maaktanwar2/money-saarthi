import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Global error handler for uncaught errors
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', { message, source, lineno, colno, error });
  return false;
};

// Global handler for unhandled promise rejections
window.onunhandledrejection = function(event) {
  console.error('Unhandled promise rejection:', event.reason);
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
