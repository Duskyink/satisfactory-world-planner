import React from 'react';
import {RECIPES,CAPS,NODESTAT,RESK,PURK,FULLK,NODES,SEED,GOALS,MAPBG,WORLD,MAPS,RAW,BP,RMAP,RNAMES,MODES,MINER,PUR,EXTRACTOR,RESCOL,UNLIMITED,TH,PRODBY,fmt,tierColor,barColor,nodeRate,maxTarget,computeStep,perItem,allInputs,cxMach,cxPow,cxShards,cxStatus,computeWorld,srcList,computeGraph,defRecipe,solveGoals,scoreSites,rawNeeds,capNear,nodesNear,Info,Tip} from '../lib/model.jsx';
function Modal({m,onClose}){const[v,setV]=React.useState("");
  React.useEffect(()=>setV((m&&m.value)||""),[m]);
  if(!m)return null;
  return(<div className="modback" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="modt">{m.title}</div>
    {m.kind==="prompt"&&<input autoFocus className="modin" value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){m.onOk(v);onClose();}}}/>}
    <div className="modbtns"><button className="modcancel" onClick={onClose}>Cancel</button>
      <button className="modok" onClick={()=>{m.onOk(m.kind==="prompt"?v:true);onClose();}}>{m.kind==="confirm"?"Confirm":"OK"}</button></div></div></div>);}

function RecipePicker({value,onChange}){const[open,setOpen]=React.useState(false),[q,setQ]=React.useState("");
  const list=(q?RNAMES.filter(n=>n.toLowerCase().includes(q.toLowerCase())):RNAMES).slice(0,80);
  return(<div className="rp"><button className="rpbtn" onClick={()=>{setOpen(o=>!o);setQ("");}}>{value}<i>v</i></button>
    {open&&<><div className="rpback" onClick={()=>setOpen(false)}/><div className="rppop">
      <input autoFocus className="rpsearch" placeholder="search 284 recipes..." value={q} onChange={e=>setQ(e.target.value)}/>
      <div className="rplist">{list.map(n=><button key={n} className={n===value?"on":""} onClick={()=>{onChange(n);setOpen(false);}}>{n}</button>)}{!list.length&&<div className="rpnone">no match</div>}</div>
    </div></>}</div>);}


export {Modal};
export {RecipePicker};
