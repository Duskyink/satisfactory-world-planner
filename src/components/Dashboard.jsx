import React from 'react';
import {RECIPES,CAPS,NODESTAT,RESK,PURK,FULLK,NODES,SEED,GOALS,MAPBG,WORLD,MAPS,RAW,BP,RMAP,RNAMES,MODES,MINER,PUR,EXTRACTOR,RESCOL,UNLIMITED,TH,PRODBY,fmt,tierColor,barColor,nodeRate,maxTarget,computeStep,perItem,allInputs,cxMach,cxPow,cxShards,cxStatus,computeWorld,srcList,computeGraph,defRecipe,solveGoals,scoreSites,rawNeeds,capNear,nodesNear,Info,Tip} from '../lib/model.jsx';
function Dashboard({cxs,kids,graph,go,prog,world,wname}){
  const[sort,setSort]=React.useState("step");
  const rows=cxs.map(c=>({c,mach:cxMach(c),pow:cxPow(c),shards:cxShards(c),flag:graph.flag[c.id],p:prog(c),st:cxStatus(c)}));
  const num=v=>+String(v==null?"":v).replace(/[^0-9.]/g,'')||0;
  const cmp={step:(a,b)=>String(a.c.bstep||"z").localeCompare(String(b.c.bstep||"z")),name:(a,b)=>a.c.name.localeCompare(b.c.name),
    tier:(a,b)=>num(a.c.tier||99)-num(b.c.tier||99),mach:(a,b)=>b.mach-a.mach,power:(a,b)=>b.pow-a.pow,
    region:(a,b)=>String(a.c.region).localeCompare(String(b.c.region)),status:(a,b)=>b.p-a.p};
  rows.sort(cmp[sort]||cmp.step);
  const H=[["status","Status","Rolls up from the steps inside: any step in progress makes it In Progress, all done makes it Complete."],
    ["name","Name","Your name for this place."],
    ["","Makes / tags","What is produced here - free text you set on the complex."],
    ["region","Region","Where it sits. Actual map placement is on the Map tab."],
    ["step","Build step","Order to build in. Same number = can be built in parallel."],
    ["mach","Machines","Production machines, excluding miners and pumps."],
    ["power","Power MW","Processing draw. Negative (green) means it generates more than it uses."],
    ["","Shards","Power shards needed for overclocking here."],
    ["tier","Tier","Earliest game tier this can be built at."]];
  const cnt=s=>rows.filter(r=>r.st===s).length;
  const active=rows.filter(r=>r.st==="In Progress");
  const maxP=Math.max(...rows.map(r=>Math.abs(r.pow)),1);
  const topP=[...rows].sort((a,b)=>b.pow-a.pow).slice(0,8);
  const gens=[...rows].filter(r=>r.pow<0).sort((a,b)=>a.pow-b.pow).slice(0,5);
  return(<div>
    <div className="mh"><h1>{wname} <Info w="320px" t="Your whole-world plan. Every figure here is computed from the recipes, node data and your targets - nothing is typed in twice."/></h1><p>{cxs.length} complexes, {world.all} production steps, {world.mach.toLocaleString()} machines. Everything below is computed live from the recipes.</p></div>
    <div className="kpis">
      <div className="kpi"><em>Complete</em><b>{cnt("Complete")}</b><span>of {rows.length} complexes</span></div>
      <div className="kpi"><em>In progress</em><b className="wip">{cnt("In Progress")}</b><span>being built now</span></div>
      <div className="kpi"><em>To do</em><b className="dimb">{cnt("To Do")}</b><span>not started</span></div>
      <div className="kpi"><em>Build complete</em><b className="or">{world.all?Math.round(world.done/world.all*100):0}%</b><span>{world.done} of {world.all} steps</span></div>
      <div className="kpi"><em>Power draw</em><b className="bad">{Math.round(world.consume).toLocaleString()}</b><span>MW incl. {world.ext} extractors</span></div>
      <div className="kpi"><em>Generation</em><b className="ok">{Math.round(world.produce).toLocaleString()}</b><span>MW planned</span></div>
      <div className="kpi"><em>Balance</em><b className={world.produce-world.consume<0?"bad":"ok"}>{Math.round(world.produce-world.consume).toLocaleString()}</b><span>MW surplus/deficit</span></div>
      <div className="kpi"><em>Power shards</em><b>{rows.reduce((a,r)=>a+r.shards,0).toLocaleString()}</b><span>for overclocking</span></div>
    </div>
    <div className="secband">POWER BALANCE <Info t="Draw is every machine plus extraction. Generation counts complexes whose recipes output Power. You want generation above draw before you rely on it."/></div>
    <div className="pwrwrap">
      <div className="pwrbar"><div className="pwgen" style={{width:Math.min(100,world.produce/Math.max(world.produce,world.consume)*100)+"%"}}><span>{Math.round(world.produce).toLocaleString()} MW generated</span></div></div>
      <div className="pwrbar"><div className="pwuse" style={{width:Math.min(100,world.consume/Math.max(world.produce,world.consume)*100)+"%"}}><span>{Math.round(world.consume).toLocaleString()} MW consumed</span></div></div>
      <div className="pwsplit">
        <div><h4>Biggest consumers</h4>{topP.filter(r=>r.pow>0).map(r=>(<div className="pwrow" key={r.c.id} onClick={()=>go(r.c.id)}>
          <span className="pwn">{r.c.name}</span><div className="pwt"><div style={{width:Math.abs(r.pow)/maxP*100+"%"}} className="pwf"/></div><span className="mono">{fmt(r.pow)}</span></div>))}</div>
        <div><h4>Generators</h4>{gens.length?gens.map(r=>(<div className="pwrow" key={r.c.id} onClick={()=>go(r.c.id)}>
          <span className="pwn">{r.c.name}</span><div className="pwt"><div style={{width:Math.abs(r.pow)/maxP*100+"%"}} className="pwf gen"/></div><span className="mono ok">{fmt(-r.pow)}</span></div>)):<div className="empty">No generator complexes yet.</div>}</div>
      </div>
    </div>
    <div className="secband">WORLD RESOURCES <Info w="330px" t="Every node of each resource in the world, and how much of its total the plan commits. 100% is the goal for a full-map build - it means nothing is left idle. Over 100% is impossible and must be fixed."/><span>nodes on the map and how much of each the plan commits</span></div>
    <div className="tblwrap"><div className="restbl">
      <div className="rrow rhead"><span>Resource</span><span>Nodes</span><span>Pure</span><span>Normal</span><span>Impure</span><span>Capacity /min</span><span>Planned /min</span><span>Used</span><span/></div>
      {world.scarcity.filter(s=>s.res!=="Water").map(s=>{const n=NODESTAT[s.res]||{};
        return(<div className="rrow" key={s.res}>
          <span className="rres">{s.res}</span><span className="mono">{n.n||0}{n.sat?"+"+n.sat+"s":""}</span>
          <span className="mono dim">{n.pure||0}</span><span className="mono dim">{n.normal||0}</span><span className="mono dim">{n.impure||0}</span>
          <span className="mono">{fmt(s.cap)}</span><span className="mono">{fmt(s.demand)}</span>
          <span className="mono" style={{color:barColor(s.pct)}}>{Math.round(s.pct)}%</span>
          <span className="rbar"><i style={{width:Math.min(100,s.pct)+"%",background:barColor(s.pct)}}/></span></div>);})}
    </div></div>
    {active.length>0&&<><div className="secband">CURRENTLY BUILDING <Info t="Complexes with at least one step marked in progress. Set a step to WIP on its complex page and it appears here."/></div>
      <div className="actwrap">{active.map(r=>(<div className="actcard" key={r.c.id} onClick={()=>go(r.c.id)}>
        <b>{r.c.name}</b><div className="actbar"><i style={{width:r.p+"%"}}/></div>
        <span>{r.p}% - {r.c.steps.filter(s=>s.status==="done").length}/{r.c.steps.length} steps - {r.mach} machines</span></div>))}</div></>}
    <div className="secband">BUILD REGISTER <Info w="320px" t="Every complex in build order. Build step 1.1 comes before 1.2; complexes sharing a number have no dependency on each other and can be built in parallel."/><span>click any row to open it</span></div>
    <div className="tblwrap"><div className="dash">
      <div className="drow dhead">{H.map(([k,l,tp],i)=><span key={i} className={k?"sortable "+(sort===k?"on":""):""} onClick={()=>k&&setSort(k)} title={tp}>{l}</span>)}</div>
      {rows.map(({c,mach,pow,shards,flag,p,st})=>(<div className={"drow"+(c.parent?" issub":"")} key={c.id} onClick={()=>go(c.id)}>
        <span><em className={"st "+(st==="Complete"?"done":st==="In Progress"?"act":"todo")}>{st}{st==="In Progress"?" "+p+"%":""}</em></span>
        <span className="dname">{flag&&<i className="flagdot" title="an input here has no source yet"/>}{c.name}</span>
        <span className="dim small">{c.tags||"-"}</span><span className="dim small">{c.region||"unassigned"}</span>
        <span className="mono">{c.bstep||"-"}</span><span className="mono">{mach}</span>
        <span className={"mono "+(pow<0?"gen":"")}>{fmt(pow)}</span><span className="mono dim">{shards}</span>
        <span><em className="tchip" style={{color:tierColor(c.tier),borderColor:tierColor(c.tier)}}>{c.tier}</em></span></div>))}
    </div></div>
    <div className="legend"><b>Legend</b>
      <span><i className="flagdot"/> input with no source, or a source too small - open the complex and fix it on INPUTS</span>
      <span><em className="st done">Complete</em> every step done</span>
      <span><em className="st act">In Progress</em> at least one step started</span>
      <span><em className="st todo">To Do</em> not started</span></div>
  </div>);
}


export {Dashboard};
