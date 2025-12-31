import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import DisplayMode from "./DisplayMode";
import PrintAnswerKey from "./PrintAnswerKey";

const root = ReactDOM.createRoot(document.getElementById("root"));

// Look for "?display" or "?print-answer-key" in the query string
const search = window.location.search || "";
const isDisplay = /\bdisplay\b/i.test(search);
const isPrintAnswerKey = /\bprint-answer-key\b/i.test(search);

let component = <App />;
if (isDisplay) component = <DisplayMode />;
if (isPrintAnswerKey) component = <PrintAnswerKey />;

root.render(<React.StrictMode>{component}</React.StrictMode>);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
