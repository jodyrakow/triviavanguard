import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import DisplayMode from "./DisplayMode";

const root = ReactDOM.createRoot(document.getElementById("root"));

const search = window.location.search || "";
const isDisplay = /\bdisplay\b/i.test(search);
const params = new URLSearchParams(search);
const isPreview = params.get("preview") === "1";

function PreviewWindow() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    document.title = "TriviaVanguard preview";
    const update = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Build the real display URL (same params minus preview=1)
  const displayParams = new URLSearchParams(search);
  displayParams.delete("preview");
  if (!displayParams.has("display")) displayParams.set("display", "");
  const displayUrl = `${window.location.origin}?${displayParams.toString()}`;

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", overflow: "hidden" }}>
      <iframe
        src={displayUrl}
        title="Display preview"
        style={{
          width: 1920,
          height: 1080,
          border: "none",
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          display: "block",
        }}
      />
    </div>
  );
}

let component = <App />;
if (isPreview) component = <PreviewWindow />;
else if (isDisplay) component = <DisplayMode />;

root.render(<React.StrictMode>{component}</React.StrictMode>);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
