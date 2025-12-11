import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import DisplayMode from "./DisplayMode"; // ⬅️ add this import

const root = ReactDOM.createRoot(document.getElementById("root"));

// Look for "?display" anywhere in the query string
const search = window.location.search || "";
const isDisplay = /\bdisplay\b/i.test(search);

root.render(
  <React.StrictMode>{isDisplay ? <DisplayMode /> : <App />}</React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
