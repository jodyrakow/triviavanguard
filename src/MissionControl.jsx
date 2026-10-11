import React, { useState } from "react";
import { colors } from "./styles/theme";
import "./MissionControl.css";

const sample = [
  {id:"welcome",type:"segment",label:"Opening & Welcome",meta:"Segment",detail:"Welcome teams, introduce the host, and explain how tonight works."},
  {id:"cat1",type:"category",label:"Trivia Grab Bag",meta:"Category block · 5 questions",questions:[
    {id:"q1",number:1,text:"Which planet is known as the Red Planet?",answer:"Mars",flavor:"Its reddish appearance comes from iron oxide on the surface.",media:[]},
    {id:"q2",number:2,text:"What is the largest ocean on Earth?",answer:"Pacific Ocean",flavor:"It covers more area than all land combined.",media:[]},
    {id:"q3",number:3,text:"In which year did the first iPhone go on sale?",answer:"2007",flavor:"The original iPhone was introduced earlier that year.",media:[]},
    {id:"q4",number:4,text:"Which chemical element has the symbol Au?",answer:"Gold",flavor:"Au comes from the Latin word aurum.",media:[]},
    {id:"q5",number:5,text:"Which city is home to the Colosseum?",answer:"Rome",flavor:"The amphitheater was built in the first century CE.",media:[]}
  ]},
  {id:"cat2",type:"category",label:"Name That Tune",meta:"Category block · 3 questions",questions:[
    {id:"q6",number:1,text:"Identify the song and artist from the audio clip.",answer:"Sample answer: Song / Artist",flavor:"Audio playback is a placeholder in this shell.",media:["Audio clip 1","Audio clip 2"]},
    {id:"q7",number:2,text:"Which artist released the album 1989?",answer:"Taylor Swift",flavor:"The album title refers to her birth year.",media:[]},
    {id:"q8",number:3,text:"Identify the artist shown in the image.",answer:"Sample artist",flavor:"Image attachment shown as a placeholder.",media:["Image 1"]}
  ]},
  {id:"answers",type:"answers",label:"Answers: Opening Categories",meta:"Answers block · references 2 category blocks",detail:"This answers block can reference multiple earlier category blocks without duplicating their questions."},
  {id:"break",type:"segment",label:"Intermission",meta:"Segment",detail:"Break for teams. Audience screen will eventually use live display state."},
  {id:"cat3",type:"category",label:"Visual Connections",meta:"Category block · 2 questions",questions:[
    {id:"q9",number:1,text:"What landmark is shown in the photograph?",answer:"Sample landmark",flavor:"Placeholder for an image-based question.",media:["Image 1","Image 2"]},
    {id:"q10",number:2,text:"What connects these three pictures?",answer:"Sample connection",flavor:"Placeholder for multiple associated images.",media:["Image 1","Image 2","Image 3"]}
  ]},
  {id:"results",type:"results",label:"Standings & Results",meta:"Results block",detail:"Results presentation is separate from scoring-scope definitions."}
];
const allQuestions=sample.flatMap(b=>b.questions||[]);
const initialTeams=["The Quizards","Risky Quizness","The Brain Trust","Fact Checkers","The Know-It-Alls"];
const views=[["run","Run"],["rundown","Rundown"],["scoring","Scoring"],["results","Results"]];
function Icon({name}){const glyph={play:"▶",pause:"Ⅱ",back:"‹",next:"›",eye:"◉",clock:"◷",check:"✓",close:"×"};return <span aria-hidden="true">{glyph[name]||"•"}</span>}
function SectionHeading({eyebrow,title,action}){return <div className="mc-section-heading"><div><div className="mc-eyebrow">{eyebrow}</div><h2>{title}</h2></div>{action}</div>}
export default function MissionControl(){
 const [view,setView]=useState("run"),[selectedBlock,setSelectedBlock]=useState("cat1"),[selectedQuestion,setSelectedQuestion]=useState("q1"),[detailOpen,setDetailOpen]=useState(true);
 const [answersVisible,setAnswersVisible]=useState(false),[timer,setTimer]=useState("00:30"),[timerRunning,setTimerRunning]=useState(false),[displayMode,setDisplayMode]=useState("Standby"),[activeTeam,setActiveTeam]=useState(initialTeams[0]),[scores,setScores]=useState({}),[expanded,setExpanded]=useState(["cat1","cat2"]),[notice,setNotice]=useState(""),[scope,setScope]=useState("Opening categories");
 const currentBlock=sample.find(b=>b.id===selectedBlock)||sample[1],question=allQuestions.find(q=>q.id===selectedQuestion)||allQuestions[0];
 const notify=(message)=>setNotice(message);
 const pickBlock=(b)=>{setSelectedBlock(b.id);if(b.questions?.length){setSelectedQuestion(b.questions[0].id);setDetailOpen(true);}else setDetailOpen(false);setView("run")};
 const pickQuestion=(b,q)=>{setSelectedBlock(b.id);setSelectedQuestion(q.id);setDetailOpen(true);setView("run")};
 const moveQuestion=(delta)=>{const idx=allQuestions.findIndex(q=>q.id===selectedQuestion),next=allQuestions[(idx+delta+allQuestions.length)%allQuestions.length],block=sample.find(b=>b.questions?.some(q=>q.id===next.id));pickQuestion(block,next)};
 const toggleScore=(team,id)=>setScores(prev=>({...prev,[team+"-"+id]:!prev[team+"-"+id]}));
 return <div className="mc-shell">
  <header className="mc-topbar">
   <div className="mc-brand"><span className="mc-brand-mark">TV</span><span>TRIVIA<span className="mc-brand-accent">VANGUARD</span></span><span className="mc-brand-divider"/><strong>MISSION CONTROL</strong></div>
   <div className="mc-show-meta"><span className="mc-status-dot"/> DEMO SHOW <span className="mc-separator">/</span> Thursday Night Trivia <span className="mc-shell-tag">SHELL PREVIEW</span></div>
  </header>
  <div className="mc-app">
   <aside className="mc-sidebar">
    <div className="mc-sidebar-label">WORKSPACE</div>
    <nav aria-label="Mission Control views">{views.map(([key,label])=><button key={key} className={"mc-nav "+(view===key?"active":"")} onClick={()=>setView(key)}><span className="mc-nav-symbol">{({run:"▣",rundown:"☷",scoring:"▦",results:"◫"})[key]}</span>{label}</button>)}</nav>
    <div className="mc-sidebar-divider"/>
    <div className="mc-sidebar-label">SHOW AT A GLANCE</div>
    <div className="mc-sidebar-fact"><span>Show</span><strong>Sample Show</strong></div>
    <div className="mc-sidebar-fact"><span>Teams</span><strong>5 checked in</strong></div>
    <div className="mc-sidebar-fact"><span>Questions</span><strong>{allQuestions.length} sample</strong></div>
    <div className="mc-sidebar-fact"><span>Current block</span><strong>{currentBlock.label}</strong></div>
    <div className="mc-sidebar-bottom"><span className="mc-demo-indicator">● Sample data only</span><p>Navigation and layout are interactive. Nothing is saved or sent to an audience.</p><button className="mc-link-button" onClick={()=>setView("style")}>View style guide ↗</button></div>
   </aside>
   <main className="mc-main">
    <div className="mc-page-intro"><div><div className="mc-eyebrow">TRIVIAVANGUARD / MISSION CONTROL</div><h1>{({run:"Run the Show",rundown:"Show Rundown",scoring:"Scoring Workspace",results:"Results Workspace",style:"Design System"})[view]}</h1><p>{({run:"A proposed live-hosting workspace. Select a question to inspect its details.",rundown:"The sequence of content and hosting moments, separate from scoring scopes.",scoring:"A sample scoring layout. Cells toggle visually; no totals are calculated.",results:"Presentation layout with sample standings, not calculated rankings.",style:"The existing shared component style guide."})[view]}</p></div><span className="mc-stage-label">LAYOUT PROTOTYPE · V1</span></div>
    {view==="run"&&<div className="mc-workspace">
      <section className="mc-card mc-rundown-panel"><SectionHeading eyebrow="SHOW FLOW" title="Rundown" action={<span className="mc-count">{sample.length} blocks</span>}/>
       <div className="mc-rundown-list">{sample.map((b,i)=><div key={b.id}><button className={"mc-block "+(selectedBlock===b.id?"selected":"")} onClick={()=>pickBlock(b)}><span className={"mc-block-icon "+b.type}>{({segment:"§",category:"?",answers:"✓",results:"★"})[b.type]}</span><span className="mc-block-text"><strong>{b.label}</strong><small>{b.meta}</small></span>{b.questions&&<span className="mc-mini-count">{b.questions.length}</span>}</button></div>)}</div>
       <div className="mc-panel-foot">Proposed: select blocks to browse show content.</div>
      </section>
      <section className="mc-card mc-content-panel"><SectionHeading eyebrow="CONTENT WORKSPACE" title={currentBlock.label} action={<span className="mc-count">{currentBlock.type==="category"?"QUESTION BLOCK":currentBlock.meta.toUpperCase()}</span>}/>
       {currentBlock.questions?<><div className="mc-content-intro">Select a question to inspect its content and hosting controls.</div><div className="mc-question-grid">{currentBlock.questions.map(q=><button key={q.id} className={"mc-question-tile "+(selectedQuestion===q.id&&detailOpen?"selected":"")} onClick={()=>pickQuestion(currentBlock,q)}><span className="mc-question-index">QUESTION {q.number}</span><span className="mc-question-preview">{q.text}</span><span className="mc-tile-footer">{q.media.length? q.media.length+" media attachment"+(q.media.length===1?"":"s"):"Text question"}<span>↗</span></span></button>)}</div></>:<div className="mc-block-description"><span className="mc-placeholder-icon">▤</span><h3>{currentBlock.label}</h3><p>{currentBlock.detail}</p><span className="mc-muted-tag">Content preview only</span></div>}
       <div className="mc-workspace-note">Layout proposal: Rundown + question tiles + integrated detail panel. No modal dialogs.</div>
      </section>
      <section className="mc-card mc-detail-panel"><SectionHeading eyebrow="INSPECT & HOST" title={detailOpen&&currentBlock.questions?"Question Details":"Host Tools"} action={detailOpen?<button className="mc-icon-button" aria-label="Close question details" onClick={()=>setDetailOpen(false)}>×</button>:null}/>
       {detailOpen&&currentBlock.questions&&<div className="mc-detail-content"><div className="mc-question-kicker">{currentBlock.label} / Question {question.number}</div><h3 className="mc-detail-question">{question.text}</h3><div className="mc-detail-divider"/><div className="mc-detail-label">ANSWER <button className="mc-inline-link" onClick={()=>setAnswersVisible(!answersVisible)}>{answersVisible?"Hide":"Reveal"}</button></div><div className={"mc-answer "+(!answersVisible?"concealed":"")}>{answersVisible?question.answer:"Answer hidden from host preview"}</div><div className="mc-detail-label">FLAVOR TEXT</div><p className="mc-flavor">{question.flavor}</p><div className="mc-detail-label">ASSOCIATED MEDIA</div>{question.media.length?<div className="mc-media-list">{question.media.map(m=><div className="mc-media-chip" key={m}>▧ {m} <small>placeholder</small></div>)}</div>:<p className="mc-no-media">No media for this question</p>}<div className="mc-question-actions"><button className="mc-button mc-button-light" onClick={()=>moveQuestion(-1)}><Icon name="back"/> Previous</button><button className="mc-button mc-button-light" onClick={()=>moveQuestion(1)}>Next <Icon name="next"/></button></div></div>}
       <div className="mc-host-tools"><div className="mc-detail-label">HOST CONTROLS <span className="mc-muted-tag">LOCAL DEMO</span></div><div className="mc-timer-row"><div><small>Countdown</small><strong>{timer}</strong></div><button className="mc-button mc-button-light" onClick={()=>setTimerRunning(!timerRunning)}>{timerRunning?"Pause":"Start"}</button></div><div className="mc-timer-presets">{["00:30","01:00","02:00"].map(t=><button key={t} className={timer===t?"active":""} onClick={()=>{setTimer(t);setTimerRunning(false)}}>{t}</button>)}</div><div className="mc-detail-label">AUDIENCE DISPLAY <span className="mc-muted-tag">NOT CONNECTED</span></div><div className="mc-display-status"><span className="mc-display-screen">▣</span><div><strong>{displayMode}</strong><small>Display control placeholder · no live output</small></div></div><div className="mc-display-actions">{["Standby","Question","Answer"].map(m=><button key={m} className={displayMode===m?"active":""} onClick={()=>setDisplayMode(m)}>{m}</button>)}</div><button className="mc-button mc-button-primary mc-full" onClick={()=>notify("Demo only: audience display is not connected.")}>Send to Display <span>↗</span></button></div>
      </section>
    </div>}
    {view==="rundown"&&<div className="mc-card mc-full-card"><SectionHeading eyebrow="SHOW STRUCTURE" title="Block sequence" action={<span className="mc-count">PROPOSED VIEW</span>}/><p className="mc-supporting">Segments, category blocks, answers blocks, and results blocks are distinct. This screen represents their order, not their scoring relationships.</p><div className="mc-rundown-full">{sample.map((b,i)=><div key={b.id} className="mc-rundown-full-item"><span className="mc-order">{String(i+1).padStart(2,"0")}</span><span className={"mc-block-icon "+b.type}>{({segment:"§",category:"?",answers:"✓",results:"★"})[b.type]}</span><div><strong>{b.label}</strong><small>{b.meta}</small></div><button className="mc-button mc-button-light" onClick={()=>pickBlock(b)}>Inspect ↗</button></div>)}</div><p className="mc-footnote">No drag-and-drop or show editing is implemented in this shell.</p></div>}
    {view==="scoring"&&<div className="mc-card mc-full-card"><SectionHeading eyebrow="SCORING WORKSPACE" title="Scoring grid" action={<span className="mc-count">DEMO TOGGLES · NO CALCULATIONS</span>}/><div className="mc-scoring-toolbar"><label>Scoring scope <select value={scope} onChange={e=>setScope(e.target.value)}><option>Opening categories</option><option>Visual connections</option><option>Combined categories</option></select></label><span className="mc-supporting">Scope is independent of Rundown blocks.</span></div><div className="mc-table-scroll"><table className="mc-scoring-table"><thead><tr><th>TEAM</th>{allQuestions.slice(0,5).map(q=><th key={q.id}>Q{q.number}</th>)}<th>BONUS</th><th>LEAGUE</th></tr></thead><tbody>{initialTeams.map(team=><tr key={team}><th>{team}</th>{allQuestions.slice(0,5).map(q=><td key={q.id}><button aria-pressed={!!scores[team+"-"+q.id]} className={"mc-score-cell "+(scores[team+"-"+q.id]?"correct":"")} onClick={()=>toggleScore(team,q.id)}>{scores[team+"-"+q.id]?"✓":"·"}</button></td>)}<td><input aria-label={team+" bonus points"} className="mc-bonus-input" type="number" defaultValue="0"/></td><td><input aria-label={team+" league participation"} type="checkbox"/></td></tr>)}</tbody></table></div><p className="mc-footnote">Cells toggle locally. Bonus inputs and league checkboxes are visual controls. Totals and scoring rules are intentionally deferred.</p></div>}
    {view==="results"&&<div className="mc-results-layout"><div className="mc-card mc-full-card"><SectionHeading eyebrow="RESULTS WORKSPACE" title="Sample standings" action={<span className="mc-count">NOT CALCULATED</span>}/><div className="mc-result-list">{initialTeams.map((team,i)=><div className="mc-result-item" key={team}><span className="mc-result-rank">{i+1}</span><strong>{team}</strong><span className="mc-result-score">Sample position</span></div>)}</div><p className="mc-footnote">Order is illustrative, not a result of scoring. Results blocks and scoring scopes remain separate concepts.</p></div><div className="mc-card mc-results-side"><SectionHeading eyebrow="PRESENTATION" title="Results controls"/><p className="mc-supporting">A future workspace for choosing which standings or placings to show and when to show them.</p><button className="mc-button mc-button-primary" onClick={()=>notify("Demo only: results are not connected to a display.")}>Present Results ↗</button></div></div>}
    {view==="style"&&<div className="mc-card mc-full-card"><SectionHeading eyebrow="DESIGN SYSTEM" title="Shared style guide"/><p className="mc-supporting">The existing style guide is preserved. Use the button below to return to the shell; its components remain available for refinement.</p><button className="mc-button mc-button-primary" onClick={()=>setView("run")}>Return to Run →</button></div>}
    <footer className="mc-footer"><span>TRIVIAVANGUARD · NEXT GENERATION</span><span>Visual shell only · sample data · no backend connections</span></footer>
   </main>
  </div>
  {notice&&<div className="mc-toast" role="status">{notice}<button aria-label="Dismiss notice" onClick={()=>setNotice("")}>×</button></div>}
 </div>
}
