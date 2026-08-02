import React from 'react';
import {RECIPES,CAPS,NODESTAT,RESK,PURK,FULLK,NODES,SEED,GOALS,MAPBG,WORLD,MAPS,RAW,BP,RMAP,RNAMES,MODES,MINER,PUR,EXTRACTOR,RESCOL,UNLIMITED,TH,PRODBY,fmt,tierColor,barColor,nodeRate,maxTarget,computeStep,perItem,allInputs,cxMach,cxPow,cxShards,cxStatus,computeWorld,srcList,computeGraph,defRecipe,solveGoals,scoreSites,rawNeeds,capNear,nodesNear,Info,Tip} from '../lib/model.jsx';
function Resources({world,graph,nm,go,cxs}){
  const und=[];for(const pid in graph.short)for(const it in graph.short[pid])und.push({pid,it,sh:graph.short[pid][it]});
  und.sort((a,b)=>b.sh-a.sh);
  const defs=Object.keys(graph.worldNet).filter(it=>!RAW.has(it)&&it!=="Power"&&graph.worldNet[it]<-TH).map(it=>({it,n:graph.worldNet[it]})).sort((a,b)=>a.n-b.n);
  const noSrc=[];for(const c of cxs)for(const n of (graph.needs[c.id]||[]))for(const r of n.rows)if(!r.from)noSrc.push({cid:c.id,it:n.item,q:n.qty});
  return(<div>
    <div className="mh"><h1>Resources</h1><p>Every raw resource on the map against what the plan commits. 100% means fully used - that is the goal, not a warning. Over 100% is impossible and must be fixed.</p></div>
    <div className="ledger">{world.scarcity.filter(s=>s.res!=="Water").map(s=>{const n=NODESTAT[s.res]||{};
      return(<div className="lrow" key={s.res}>
        <div className="lres">{s.res}<em>{n.n||0} nodes{n.sat?" +"+n.sat+" sat":""}</em></div>
        <div className="ltrack"><div className="lfill" style={{width:Math.min(100,s.pct)+"%",background:barColor(s.pct)}}/>
          {s.pct>100&&<div className="lover" style={{width:Math.min(100,s.pct-100)+"%"}}/>}</div>
        <div className="lnum"><b style={{color:barColor(s.pct)}}>{Math.round(s.pct)}%</b><span>{fmt(s.demand)} / {fmt(s.cap)}</span></div></div>);})}</div>
    <div className="secband">ITEMS WITH NO SOURCE <Info w="320px" t="This complex consumes the item but no source is set. Open it, find the item in INPUTS, and pick where it comes from - a node on site or another complex."/><span>an input with no origin assigned</span></div>
    <div className="unres">{noSrc.length?noSrc.slice(0,25).map((x,i)=>(<div className="urow bad" key={i} onClick={()=>go(x.cid)}>
      <span className="utag">NO SOURCE</span><b>{nm(x.cid)}</b><span>needs <b>{fmt(x.q)}/min {x.it}</b> - open it and pick a source</span></div>)):
      <div className="urow ok"><span className="utag ok">OK</span><span>Every input has a source assigned.</span></div>}</div>
    <div className="secband">SOURCE TOO SMALL <Info w="320px" t="You pointed an input at a producer, but that producer\u2019s spare output is less than what its consumers ask for. Raise the producer\u2019s target, or split the input across more sources."/><span>producer cannot cover what it was asked for</span></div>
    <div className="unres">{und.length?und.slice(0,25).map((u,i)=>(<div className="urow warn" key={i} onClick={()=>go(u.pid)}>
      <span className="utag warn">SHORT</span><b>{nm(u.pid)}</b><span>its consumers want <b>{fmt(u.sh)}/min</b> more {u.it} than it has spare</span></div>)):
      <div className="urow ok"><span className="utag ok">OK</span><span>Every producer covers what it was asked for.</span></div>}</div>
    <div className="secband">NOTHING MAKES ENOUGH <Info w="320px" t="Across the entire world, total production of this item is below total consumption. Somebody has to make more - size up an existing producer or add a new complex."/><span>a genuine world-wide production gap</span></div>
    <div className="unres">{defs.length?defs.slice(0,25).map((d,i)=>(<div className="urow warn" key={i}>
      <span className="utag warn">GAP</span><b>{d.it}</b><span>short <b>{fmt(-d.n)}/min</b> across the whole world - size up a producer or add one</span></div>)):
      <div className="urow ok"><span className="utag ok">OK</span><span>World production covers world consumption.</span></div>}</div>
  </div>);
}


export {Resources};
