import React from 'react';
import {RECIPES,CAPS,NODESTAT,RESK,PURK,FULLK,NODES,SEED,GOALS,MAPBG,WORLD,MAPS,RAW,BP,RMAP,RNAMES,MODES,MINER,PUR,EXTRACTOR,RESCOL,UNLIMITED,TH,PRODBY,fmt,tierColor,barColor,nodeRate,maxTarget,computeStep,perItem,allInputs,cxMach,cxPow,cxShards,cxStatus,computeWorld,srcList,computeGraph,defRecipe,solveGoals,scoreSites,rawNeeds,capNear,nodesNear,Info,Tip} from '../lib/model.jsx';
function Goals({goals,setGoals,world}){
  const[choice,setChoice]=React.useState({});
  const res=React.useMemo(()=>solveGoals(goals,choice),[goals,choice]);
  const set=(i,q)=>setGoals(goals.map((g,j)=>j===i?{...g,qty:q}:g));
  const scaleAll=f=>setGoals(goals.map(g=>({...g,qty:Math.round(g.qty*f*100)/100})));
  const phases=Array.from(new Set(goals.map(g=>g.phase)));
  const rows=Object.keys(CAPS).map(k=>({res:k,need:res.raw[k]||0,cap:CAPS[k],pct:(res.raw[k]||0)/CAPS[k]*100})).sort((a,b)=>b.pct-a.pct);
  const over=rows.filter(r=>r.pct>100);
  return(<div>
    <div className="mh"><h1>Goals - what the world is for <Info w="360px" t="Set how much of each end product you want per minute. Everything below - every intermediate, every raw resource, the machine count and the power - is derived from these numbers. Raise them until the map is as full as you want it."/></h1>
      <p>Decide the output, and the whole factory falls out of it. This is the top of the plan: change a number here and the resource budget below updates instantly.</p></div>
    <div className="kpis">
      <div className="kpi"><em>Machines needed</em><b>{res.mach.toLocaleString()}</b><span>across {Object.keys(res.steps).length} recipes</span></div>
      <div className="kpi"><em>Power needed</em><b className="bad">{Math.round(res.pow).toLocaleString()}</b><span>MW for production</span></div>
      <div className="kpi"><em>Tightest resource</em><b className={over.length?"bad":"ok"}>{res.bind||"-"}</b><span>{rows[0]?Math.round(rows[0].pct)+"% used":""}</span></div>
      <div className="kpi"><em>Room to grow</em><b className={res.head&&res.head<1?"bad":"ok"}>{res.head?(res.head>=1?res.head.toFixed(1)+"x":"OVER"):"-"}</b><span>scale all goals by this and it still fits</span></div>
    </div>
    {res.head&&<div className="scalebar"><span>Scale every goal:</span>
      {[0.5,2,5,10].map(f=><button key={f} className="addrow" onClick={()=>scaleAll(f)}>x{f}</button>)}
      {res.head>=1&&<button className="addrow fit" onClick={()=>scaleAll(res.head)}>fill the map (x{res.head.toFixed(2)})</button>}
      <Info t="Fill the map multiplies every goal until the first resource hits exactly 100%. That is the largest version of this plan the world can support."/></div>}
    {over.length>0&&<div className="overwarn">Over capacity: {over.map(o=>o.res+" "+Math.round(o.pct)+"%").join(", ")} - reduce goals or pick cheaper recipes.</div>}
    {phases.map(p=>(<React.Fragment key={p}>
      <div className="secband">{p.toUpperCase()}</div>
      <div className="goalgrid">{goals.map((g,i)=>g.phase!==p?null:(
        <div className={"goalcard"+(g.qty>0?" on":"")} key={g.item}>
          <b>{g.item}</b>
          <div className="goalrow"><input type="number" min="0" step="0.5" value={g.qty} onChange={e=>set(i,+e.target.value||0)}/><em>/min</em></div>
          <select className="dsel" value={choice[g.item]||defRecipe(g.item)||""} onChange={e=>setChoice({...choice,[g.item]:e.target.value})}>
            {(PRODBY[g.item]||[]).map(n=><option key={n} value={n}>{n}</option>)}</select>
        </div>))}</div>
    </React.Fragment>))}
    <div className="secband">RAW RESOURCES THESE GOALS REQUIRE <Info t="Computed by exploding every goal down through its recipes to raw ore. Compare against what the map holds."/></div>
    <div className="ledger">{rows.map(r=>(<div className="lrow" key={r.res}>
      <div className="lres">{r.res}<em>{(NODESTAT[r.res]||{}).n||0} nodes</em></div>
      <div className="ltrack"><div className="lfill" style={{width:Math.min(100,r.pct)+"%",background:barColor(r.pct)}}/>
        {r.pct>100&&<div className="lover" style={{width:Math.min(100,r.pct-100)+"%"}}/>}</div>
      <div className="lnum"><b style={{color:barColor(r.pct)}}>{r.pct<0.05?"0":r.pct<1?r.pct.toFixed(1):Math.round(r.pct)}%</b><span>{fmt(r.need)} / {fmt(r.cap)}</span></div></div>))}</div>
    <div className="secband">PRODUCTION THIS IMPLIES <span>{Object.keys(res.steps).length} recipes, biggest first</span></div>
    <div className="tblwrap"><div className="goaltbl">
      <div className="grow ghead"><span>Recipe</span><span>Building</span><span>Machines</span><span>Rate /min</span></div>
      {Object.entries(res.steps).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([rn,runs])=>{const r=RMAP[rn];
        return(<div className="grow" key={rn}><span className="oitem">{rn}</span><span className="dim small">{r.b}</span>
          <span className="mono">{Math.ceil(runs)}</span><span className="mono dim">{fmt(runs*(r.o[0]?r.o[0][1]:0))} {r.o[0]?r.o[0][0]:""}</span></div>);})}
    </div></div>
  </div>);
}

export {Goals};
