import React from 'react';
import {RECIPES,CAPS,NODESTAT,RESK,PURK,FULLK,NODES,SEED,GOALS,MAPBG,WORLD,MAPS,RAW,BP,RMAP,RNAMES,MODES,MINER,PUR,EXTRACTOR,RESCOL,UNLIMITED,TH,PRODBY,fmt,tierColor,barColor,nodeRate,maxTarget,computeStep,perItem,allInputs,cxMach,cxPow,cxShards,cxStatus,computeWorld,srcList,computeGraph,defRecipe,solveGoals,scoreSites,rawNeeds,capNear,nodesNear,Info,Tip} from './lib/model.jsx';
import {Modal,RecipePicker} from './components/Ui.jsx';
import {Goals} from './components/Goals.jsx';
import {Dashboard} from './components/Dashboard.jsx';
import {Resources} from './components/Resources.jsx';
import {MapView,Reach} from './components/MapView.jsx';
import {Transport} from './components/Transport.jsx';
import {Complex} from './components/Complex.jsx';
import {WorldGraph} from './components/WorldGraph.jsx';
import {APP_PLAN} from './lib/data.js';
import './styles.css';
function App(){
  const[cxs,setCxs]=React.useState(null);
  const[wname,setWname]=React.useState("");
  const[sel,setSel]=React.useState("dash");
  const[q,setQ]=React.useState(""),[saved,setSaved]=React.useState(""),[modal,setModal]=React.useState(null);
  const[goals,setGoalsS]=React.useState(GOALS);
  React.useEffect(()=>{(async()=>{
    try{const r=await window.storage.get("plan_v10",true);setCxs(r&&r.value?JSON.parse(r.value):APP_PLAN);}catch(e){setCxs(APP_PLAN);}
    try{const w=await window.storage.get("worldname_v8",true);setWname(w&&w.value?w.value:"My Satisfactory World");}catch(e){setWname("My Satisfactory World");}
    try{const g=await window.storage.get("goals_v8",true);if(g&&g.value)setGoalsS(JSON.parse(g.value));}catch(e){}
  })();},[]);
  const persist=async next=>{setCxs(next);try{await window.storage.set("plan_v10",JSON.stringify(next),true);setSaved("saved");setTimeout(()=>setSaved(""),900);}catch(e){}};
  const saveName=async v=>{setWname(v);try{await window.storage.set("worldname_v8",v,true);}catch(e){}};
  const setGoals=async g=>{setGoalsS(g);try{await window.storage.set("goals_v8",JSON.stringify(g),true);}catch(e){}};
  const world=React.useMemo(()=>cxs?computeWorld(cxs):null,[cxs]);
  const graph=React.useMemo(()=>cxs?computeGraph(cxs):null,[cxs]);
  if(!cxs||!world)return <div style={{padding:40,color:"#7f8c99",font:"14px ui-monospace"}}>Loading...</div>;
  const kids=p=>cxs.filter(c=>c.parent===p);
  const nm=id=>{const c=cxs.find(x=>x.id===id);return c?c.name:"";};
  const stName=(cid,sid)=>{const c=cxs.find(x=>x.id===cid);if(!c)return"";const s=(c.stations||[]).find(y=>y.id===sid);return s?s.name:"";};
  const match=c=>!q||(c.name+" "+(c.tags||"")+" "+(c.region||"")).toLowerCase().includes(q.toLowerCase());
  const tops=cxs.filter(c=>!c.parent).sort((a,b)=>String(a.bstep||"9.9").localeCompare(String(b.bstep||"9.9"),undefined,{numeric:true}));
  const selCx=cxs.find(c=>c.id===sel);
  const up=(id,fn)=>persist(cxs.map(c=>c.id===id?fn(c):c));
  const editStep=(cid,sid,p)=>up(cid,c=>({...c,steps:c.steps.map(s=>s.id===sid?{...s,...p}:s)}));
  const addStep=cid=>up(cid,c=>({...c,steps:[...c.steps,{id:"s"+Date.now(),recipe:RNAMES[0],target:100,clock:100,status:"todo",sec:"PRODUCTION",name:""}]}));
  const delStep=(cid,sid)=>up(cid,c=>({...c,steps:c.steps.filter(s=>s.id!==sid)}));
  const setSrcRows=(cid,item,rows)=>up(cid,c=>({...c,sourcesN:{...(c.sourcesN||{}),[item]:rows}}));
  const setDestRows=(cid,item,rows)=>up(cid,c=>({...c,dests:{...(c.dests||{}),[item]:rows}}));
  const addStation=cid=>setModal({kind:"prompt",title:"Station name (e.g. Steel Pipe Out, Ore In)",value:"",onOk:n=>{if(!n)return;
    up(cid,c=>({...c,stations:[...(c.stations||[]),{id:"st"+Date.now(),name:n,mode:"train",cars:4,items:[]}]}));}});
  const editStation=(cid,sid,p)=>up(cid,c=>({...c,stations:(c.stations||[]).map(s=>s.id===sid?{...s,...p}:s)}));
  const delStation=(cid,sid)=>up(cid,c=>({...c,stations:(c.stations||[]).filter(s=>s.id!==sid)}));
  const addComplex=parent=>setModal({kind:"prompt",title:parent?"New sub-complex name":"New complex name",value:"",onOk:n=>{if(!n)return;
    const nc={id:"c"+Date.now(),name:n,region:"",parent,tier:"T?",bstep:"",tags:"",status:"To Do",steps:[],totals:{},sourcesN:{},dests:{},stations:[],desc:""};
    persist([...cxs,nc]);setSel(nc.id);}});
  const delComplex=id=>setModal({kind:"confirm",title:"Remove this complex and its sub-complexes?",onOk:()=>{persist(cxs.filter(c=>c.id!==id&&c.parent!==id));setSel("dash");}});
  const reload=()=>setModal({kind:"confirm",title:"Regenerate from the engine plan? Overwrites your edits.",onOk:()=>persist(APP_PLAN)});
  const prog=c=>{let a=0,d=0;const walk=x=>{x.steps.forEach(s=>{a++;if(s.status==="done")d++;});kids(x.id).forEach(walk);};walk(c);return a?Math.round(d/a*100):0;};
  const producersOf=it=>cxs.filter(x=>{const p=graph.per[x.id];return p&&p[it]&&(p[it].made-p[it].used)>0.5;});
  const consumersNeeding=it=>cxs.filter(x=>{const p=graph.per[x.id];return p&&p[it]&&(p[it].made-p[it].used)<-0.5;});
  const go=id=>{if(cxs.some(c=>c.id===id))setSel(id);};
  const NAV=[["dash","Dashboard"],["goals","Goals"],["res","Resources"],["world","World (engine)"],["map","Map & placement"],["logistics","Transport"]];
  const flagged=Object.values(graph.flag).filter(Boolean).length;
  return(<div className="app"><Modal m={modal} onClose={()=>setModal(null)}/>
    <header className="hd"><div className="brand"><span className="mark"/>
      <input className="wname" value={wname} onChange={e=>saveName(e.target.value)}/></div>
      <div className="hdr-stats"><span>{world.mach.toLocaleString()} machines</span><i/>
        <span className="pcons">{Math.round(world.consume).toLocaleString()} MW draw</span>
        <span className="pprod">{Math.round(world.produce).toLocaleString()} MW gen</span><i/>
        {flagged>0?<Tip t="Complexes with an input that has no source assigned, or whose chosen source cannot supply enough. Open Resources to see the full list."><span className="flagcount">{flagged} need sourcing</span></Tip>:<span className="okcount">all sourced</span>}
        <span className="bpct">{world.all?Math.round(world.done/world.all*100):0}% built</span>
        <button className="reload" onClick={reload}>reload</button><span className="saved">{saved}</span></div></header>
    <div className="body"><aside className="side">
      {NAV.map(([id,l])=><button key={id} className={"navrow world "+(sel===id?"on":"")} onClick={()=>setSel(id)}><span className="dot"/>{l}</button>)}
      <div className="sidehd">COMPLEXES<button className="add" onClick={()=>addComplex(null)}>+</button></div>
      <input className="sfilter" placeholder="filter by name, tag, region..." value={q} onChange={e=>setQ(e.target.value)}/>
      {tops.filter(c=>match(c)||kids(c.id).some(match)).map(c=>(<div key={c.id}>
        <button className={"navrow "+(sel===c.id?"on":"")} onClick={()=>setSel(c.id)}>
          <span className="tchip" style={{color:tierColor(c.tier),borderColor:tierColor(c.tier)}}>{c.tier}</span>
          <span className="nm">{c.name}<em>{c.tags||c.region}</em></span>
          {graph.flag[c.id]&&<span className="flagdot" title="an input here has no source yet, or its source is undersized"/>}
          <span className="pct">{prog(c)}%</span></button>
        {kids(c.id).map(k=>(<button key={k.id} className={"navrow sub "+(sel===k.id?"on":"")} onClick={()=>setSel(k.id)}>
          <span className="tchip sm" style={{color:tierColor(k.tier),borderColor:tierColor(k.tier)}}>{k.tier}</span>
          <span className="nm">{k.name}<em>{k.tags||"sub-complex"}</em></span>
          {graph.flag[k.id]&&<span className="flagdot"/>}<span className="pct">{prog(k)}%</span></button>))}
      </div>))}</aside>
      <main className="main">
        {sel==="dash"?<Dashboard cxs={cxs} kids={kids} graph={graph} go={setSel} prog={prog} world={world} wname={wname}/>:
         sel==="goals"?<Goals goals={goals} setGoals={setGoals} world={world}/>:
         sel==="res"?<Resources world={world} graph={graph} nm={nm} go={go} cxs={cxs}/>:
         sel==="world"?<WorldGraph/>:
         sel==="map"?<MapView cxs={cxs} up={up} persist={persist}/>:
         sel==="logistics"?<Transport cxs={cxs} graph={graph} nm={nm} go={go} stName={stName}/>:
         selCx?<Complex c={selCx} kids={kids(selCx.id)} graph={graph} nm={nm} go={go} cxs={cxs} stName={stName}
           producersOf={producersOf} consumersNeeding={consumersNeeding} editStep={editStep} addStep={addStep} delStep={delStep}
           up={up} setSrcRows={setSrcRows} setDestRows={setDestRows} addStation={()=>addStation(selCx.id)}
           editStation={editStation} delStation={delStation} addSub={()=>addComplex(selCx.id)} del={()=>delComplex(selCx.id)}/>:
         <div className="empty" style={{padding:40}}>Removed. <button className="link" onClick={()=>setSel("dash")}>Back to dashboard</button></div>}
      </main></div></div>);
}


export default App;
