import React, { useState } from "react";
import MissionControl from "./MissionControl.jsx";
import StyleGuide from "./StyleGuide.jsx";
export default function App(){const [guide,setGuide]=useState(false);return <>{guide?<><div style={{padding:12,background:"#2B394A"}}><button style={{background:"#DC6A24",color:"white",border:0,borderRadius:8,padding:"10px 16px",cursor:"pointer"}} onClick={()=>setGuide(false)}>← Back to Mission Control</button></div><StyleGuide/></>:<MissionControl/>}<button onClick={()=>setGuide(v=>!v)} style={{position:"fixed",bottom:12,left:12,zIndex:100,background:"#2B394A",color:"white",border:"1px solid #71808c",borderRadius:7,padding:"7px 10px",fontSize:11,cursor:"pointer"}}>{guide?"Mission Control":"Style Guide"}</button></>}
