import React, { useEffect, useMemo, useState } from "react";
import "./MissionControl.css";

// Visual cockpit prototype. Production state, permissions, persistence and the
// actual audience renderer will be supplied by the application integration.
const groups = [
  {name:"Welcome",blocks:[["Opening",["Sponsor slide","House rules","Welcome"]]]},
  {name:"Game 1",blocks:[["Trivia Grab Bag",Array.from({length:10},(_,i)=>"Question "+(i+1))],["The Big Picture",["Category intro",...Array.from({length:5},(_,i)=>"Question "+(i+1))]],["Answers",Array.from({length:10},(_,i)=>"Answer "+(i+1))],["Music Mix",Array.from({length:5},(_,i)=>"Track "+(i+1))],["Around the World",Array.from({length:8},(_,i)=>"Question "+(i+1))]]},
  {name:"Break",blocks:[["Break",["Stretch break","Sponsor slide","Walkout tune"]]]},
  {name:"Game 2",blocks:[["Trivia Grab Bag",Array.from({length:10},(_,i)=>"Question "+(i+1))],["Visual",["Category intro",...Array.from({length:10},(_,i)=>"Image "+String.fromCharCode(65+i))]],["Audio",Array.from({length:5},(_,i)=>"Clip "+(i+1))]]},
  {name:"Final",blocks:[["Results",["Results splash","Standings","First place"]],["Closing",["Thank you","Closing sponsor"]]]}
];
const labels = [
  [["Sponsor","Rules","Welcome"]],
  [["1","2","3","4","5","6","7","8","9","10"],["Intro","1","2","3","4","5"],["1","2","3","4","5","6","7","8","9","10"],["♪1","♪2","♪3","♪4","♪5"],["1","2","3","4","5","6","7","8"]],
  [["Break","Sponsor","Music"]],
  [["1","2","3","4","5","6","7","8","9","10"],["Intro","A","B","C","D","E","F","G","H","I","J"],["♫1","♫2","♫3","♫4","♫5"]],
  [["Splash","Standings","1st"],["Thanks","Sponsor"]]
];
const items = groups.flatMap((segment,s)=>segment.blocks.flatMap(([block,names],b)=>names.map((name,i)=>({id:`${s}-${b}-${i}`,s,b,name,block,gridLabel:labels[s][b][i]}))));
const initialPosition=items.findIndex(x=>x.s===1&&x.block==="Answers"&&x.name==="Answer 7");
const title=x=>x?.name==="Category intro"?x.block:x?.name?.toUpperCase()||"";
const subtitle=x=>x?.name==="Category intro"?"Identify the movie from the clues on screen.":x?.name?.startsWith("Answer")?"Correct answer and live updated team statistics appear here.":x?.name?.startsWith("Question")?"Which movie features this iconic scene?":`${x?.block||""} — ${x?.name||""}`;
const timeText=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,"0")}`;
function Glyph({name}) {
  const paths={monitor:<><rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 21h8M12 18v3"/></>,link:<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/></>,clipboard:<><rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></>,settings:<><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></>};
  return <svg className="cockpit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export default function MissionControl(){
  const [segment,setSegment]=useState(1),[position,setPosition]=useState(initialPosition),[repeats,setRepeats]=useState(false),[repeatItem,setRepeatItem]=useState(null);
  const [inspected,setInspected]=useState(null),[expanded,setExpanded]=useState(false),[settings,setSettings]=useState(false),[search,setSearch]=useState("");
  const [seconds,setSeconds]=useState(45),[timerState,setTimerState]=useState("idle"),[notice,setNotice]=useState("");
  const next=Math.min(position+1,items.length-1),onAir=items[repeats&&repeatItem!==null?repeatItem:position],upNext=items[next];
  const rows=useMemo(()=>groups.flatMap((g,s)=>g.blocks.map(([name],b)=>({name,s,b,entries:items.filter(x=>x.s===s&&x.b===b&&(!search||(`${x.block} ${x.name}`).toLowerCase().includes(search.toLowerCase())))}))).filter(g=>g.entries.length&&(search||g.s===segment)),[segment,search]);
  const go=()=>{if(repeats)return;setPosition(p=>Math.min(items.length-1,p+1));};
  const back=()=>{if(repeats)return;setPosition(p=>Math.max(0,p-1));};
  const toggleTimer=()=>setTimerState(s=>s==="running"?"paused":"running");
  const resetTimer=()=>{setTimerState("idle");setSeconds(45);};
  useEffect(()=>{if(timerState!=="running")return;const id=setInterval(()=>setSeconds(s=>{if(s<=1){setTimerState("idle");return 0;}return s-1;}),1000);return()=>clearInterval(id);},[timerState]);
  useEffect(()=>{const handler=e=>{const tag=e.target?.tagName?.toLowerCase();if(["input","textarea","select"].includes(tag)||e.metaKey||e.ctrlKey||e.altKey)return;if(e.key==="ArrowRight"){e.preventDefault();go();}if(e.key==="ArrowLeft"){e.preventDefault();back();}if(e.key==="ArrowUp"){e.preventDefault();toggleTimer();}if(e.key==="Escape"){setInspected(null);setExpanded(false);setSettings(false);}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);});
  const inspect=i=>{if(repeats){setRepeatItem(i);return;}setInspected(p=>p===i?null:i);};
  const message=m=>{setNotice(m);};
  return <div className="cockpit">
    <header className="cockpit-top"><span>TRIVIAVANGUARD · FRIDAY NIGHT TRIVIA · TAVERN</span><span className="cockpit-lifecycle">BUILD　 PREFLIGHT　 READY　 <b>RUN</b>　 COMPLETE</span></header>
    <nav className="cockpit-nav"><button onClick={()=>message("Builder integration is not connected in this prototype.")}>BUILD</button><button onClick={()=>message("Teams integration is not connected in this prototype.")}>TEAMS</button><button className="selected">RUN</button></nav>
    <div className="cockpit-toolbar">
      <div className="cockpit-brand">TRIVIA<span>VANGUARD</span></div>
      <div className="cockpit-utilities">
        <button title="Open Display" onClick={()=>message("Prototype only: live Display is not connected.")}><Glyph name="monitor"/>Open Display</button>
        <button title="Link to Display" onClick={()=>message("Prototype only: shareable Display URL is not connected.")}><Glyph name="link"/>Link to Display</button>
        <button aria-label="Print Answer Key" title="Print Answer Key" onClick={()=>message("Prototype only: answer-key printing is not connected.")}><Glyph name="clipboard"/></button>
        <button aria-label="Show Settings" title="Show Settings" onClick={()=>setSettings(s=>!s)}><Glyph name="settings"/></button>
      </div>
      <div className="cockpit-production">
        <button className="cockpit-back" title="Previous step · Left Arrow" onClick={back}>← BACK</button>
        <button className="cockpit-go" title="Next step · Right Arrow" onClick={go}>GO →</button>
        <div className="cockpit-timer"><button title="Reset countdown" onClick={resetTimer}>↺</button><strong>{timeText(seconds)}</strong><button title="Start / pause / resume · Up Arrow" onClick={toggleTimer}>{timerState==="running"?"Ⅱ Pause":timerState==="paused"?"▶ Resume":"▶ Start"}</button></div>
      </div>
    </div>
    <main className="cockpit-workspace">
      <div className="cockpit-stage-row">
        <section className="cockpit-live"><div className="cockpit-stage"><span className="cockpit-stage-logo">TriviaVanguard</span><h1>{title(onAir)}</h1><p>{subtitle(onAir)}</p>{repeats&&repeatItem!==null&&<div className="cockpit-repeat-watermark">↻ TEMPORARY REPEAT</div>}</div></section>
        <aside className="cockpit-side"><section className="cockpit-hud"><div className="cockpit-eyebrow">HOST HUD · CONTEXT</div><h2>{onAir.block}</h2><p className="cockpit-note">{onAir.name==="Category intro"?"Remind teams to write the movie title, not the actor's name. Allow 45 seconds per question.":`Currently presenting ${onAir.name}. Host-only notes and contextual cues appear here.`}</p><p>{repeats&&repeatItem!==null?`Repeat is live. Original program position is preserved: ${items[position].name}.`:"Host-only instructions for the current production step appear here."}</p><small>Host-only notes and pronunciation appear here.</small></section><section className="cockpit-upnext"><div><div className="cockpit-eyebrow">UP NEXT · STANDBY</div><h3>{upNext.name}</h3><small>Next GO / → advances here</small><button onClick={()=>setExpanded(true)}>Expand preview ↗</button></div><div className="cockpit-mini">{title(upNext)}</div></section></aside>
      </div>
      <section className="cockpit-bottom"><div className="cockpit-navigation">
        <div className="cockpit-tabs">{groups.map((g,i)=><button key={g.name} className={segment===i?"active":""} onClick={()=>{setSegment(i);setSearch("");}}>{g.name}</button>)}</div>
        <div className="cockpit-navhead"><strong>RUNDOWN NAVIGATION</strong><input aria-label="Find any item" placeholder="Find any item…" value={search} onChange={e=>setSearch(e.target.value)}/><button className={repeats?"active":""} onClick={()=>{setRepeats(x=>!x);setRepeatItem(null);}}>↻ REPEATS: {repeats?"ON":"OFF"}</button></div>
        <div className="cockpit-rows">{rows.map(g=><div className="cockpit-blockrow" key={g.s+"-"+g.b}><div className={"cockpit-blocklabel "+(g.entries.some(x=>x.id===items[position].id)?"current":"")}>{g.name}</div><div className="cockpit-blockitems">{g.entries.map(x=>{const index=items.indexOf(x);return <button key={x.id} className={"cockpit-item "+(index===position?"onair ":"")+(repeats&&index===repeatItem?"repeat":"")} title={repeats?"Show this item temporarily":"Inspect privately (click again to close)"} onClick={()=>inspect(index)} onContextMenu={e=>{e.preventDefault();setPosition(index);setRepeats(false);setRepeatItem(null);}}>{x.gridLabel}</button>})}</div></div>)}</div>
        <div className="cockpit-statuses"><div>PRODUCTION <strong>{items[position].name}</strong></div><div>▣ ON AIR <strong>{onAir.name}</strong></div></div>
        <div className="cockpit-footer"><span>{repeats?"REPEATS ACTIVE · Grid clicks send content LIVE.":"Click = private inspection. Right-click = Start from here."}</span><span>← BACK · → GO · ↑ TIMER · Esc closes inspector</span></div>
      </div><aside className="cockpit-bottom-context"><div>Click = private inspection. Right-click → Start from here. GO advances production.</div><div style={{color:"#b7c7d5",fontSize:12}}>← BACK · → GO · ↑ TIMER · Esc closes inspector</div></aside></section>
    </main>
    {settings&&<aside className="cockpit-dock"><div><strong>SHOW SETTINGS</strong><button onClick={()=>setSettings(false)}>✕</button></div><p>Prototype panel. Settings will be sourced from the Show Builder.</p><label>Host names<input disabled value="Jody" readOnly/></label><label>Prize information<input disabled value="Configured in Show Builder" readOnly/></label><label>Default timer<input disabled value="0:45" readOnly/></label></aside>}
    {inspected!==null&&<div className="cockpit-shade" onClick={()=>setInspected(null)}><section className="cockpit-dialog" onClick={e=>e.stopPropagation()}><header><div><strong>PRIVATE PREVIEW · {items[inspected].name.toUpperCase()}</strong><small>Private to this host · Audience display and progression unchanged</small></div><button onClick={()=>setInspected(null)}>✕ Close</button></header><div className="cockpit-dialogbody"><div className="cockpit-preview">{title(items[inspected])}</div><div><strong>ITEM DETAILS</strong><p>{groups[items[inspected].s].name} → {items[inspected].block} → {items[inspected].name}</p><p>Configured display, host notes and media will appear here when connected.</p></div></div></section></div>}
    {expanded&&<div className="cockpit-shade" onClick={()=>setExpanded(false)}><section className="cockpit-dialog" onClick={e=>e.stopPropagation()}><header><strong>UP NEXT · 1920 × 1080 scaled</strong><button onClick={()=>setExpanded(false)}>✕ Close</button></header><div className="cockpit-preview cockpit-preview-large">{title(upNext)}</div><p>Host-only preview. Opening it does not change what is on air.</p></section></div>}
    {notice&&<div className="cockpit-toast" role="status">{notice}<button onClick={()=>setNotice("")}>✕</button></div>}
  </div>;
}
