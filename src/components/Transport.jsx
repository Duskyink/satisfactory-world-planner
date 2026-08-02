import React from 'react';
import {RECIPES,CAPS,NODESTAT,RESK,PURK,FULLK,NODES,SEED,GOALS,MAPBG,WORLD,MAPS,RAW,BP,RMAP,RNAMES,MODES,MINER,PUR,EXTRACTOR,RESCOL,UNLIMITED,TH,PRODBY,fmt,tierColor,barColor,nodeRate,maxTarget,computeStep,perItem,allInputs,cxMach,cxPow,cxShards,cxStatus,computeWorld,srcList,computeGraph,defRecipe,solveGoals,scoreSites,rawNeeds,capNear,nodesNear,Info,Tip} from '../lib/model.jsx';
function Transport({cxs,graph,nm,go,stName}){
  const[f,setF]=React.useState("");
  const stations=[];
  for(const c of cxs)for(const s of (c.stations||[]))stations.push({c,s});
  const flows=[];
  for(const c of cxs){const cons=graph.consumers[c.id]||{};
    for(const it in cons)for(const x of cons[it])flows.push({from:c.id,to:x.id,it,qty:x.qty,station:x.station});}
  flows.sort((a,b)=>b.qty-a.qty);
  const rows=flows.filter(x=>!f||(nm(x.from)+nm(x.to)+x.it).toLowerCase().includes(f.toLowerCase()));
  return(<div>
    <div className="mh"><h1>Transport</h1><p>Every station you have defined, what rides on it, and every flow between complexes. Define stations on a complex - then inputs and outputs can name the exact station a part leaves from or arrives at.</p></div>
    <div className="secband">STATIONS <Info w="330px" t="Named docks you define on each complex. The bar shows how full the vehicle is: each coloured segment is one item\u2019s share of the total freight capacity."/><span>{stations.length} defined across the world</span></div>
    <div className="tlist">{stations.map(({c,s})=>{const per=MODES[s.mode||"train"].per,cars=s.cars||4;
      const qty=(s.items||[]).reduce((a,it)=>{const p=graph.per[c.id];return a+(p&&p[it]?Math.max(0,p[it].made-p[it].used):0);},0);
      const need=Math.ceil(qty/per)||0,fill=cars*per?qty/(cars*per)*100:0;let acc=0;
      return(<div className="tcard" key={s.id}>
        <div className="thd"><b className="clink" onClick={()=>go(c.id)}>{s.name}</b><span className="mono dim">{c.name}</span></div>
        <div className="tbar">{(s.items||[]).map((it,j)=>{const p=graph.per[c.id];const q=p&&p[it]?Math.max(0,p[it].made-p[it].used):0;
          const w=cars*per?q/(cars*per)*100:0;const from=acc;acc+=w;
          return <div key={j} className="tseg" style={{width:Math.min(100-from,w)+"%"}} title={it+" "+fmt(q)}/>;})}
          {fill<100&&<div className="tspare" style={{width:Math.max(0,100-Math.min(100,fill))+"%"}}/>}</div>
        <div className="tmeta"><span>{MODES[s.mode||"train"].label} / {cars} {MODES[s.mode||"train"].unit}s</span><i/>
          <span className="mono">{fmt(qty)}/min</span><i/>
          <span className={need>cars?"stbad":"stok"}>{need>cars?"needs "+need:"uses "+need+" of "+cars+" ("+Math.round(fill)+"% full)"}</span></div>
        <div className="titems">{(s.items||[]).length?(s.items||[]).map((it,j)=><span key={j}>{it}</span>):<span className="dim">no items assigned</span>}</div></div>);})}
      {!stations.length&&<div className="empty">No stations yet. Open a complex and use "+ station".</div>}</div>
    <div className="secband">FLOWS <Info t="Every part movement implied by your input sourcing. Assign a station on the input or output row and it appears here, so you know which dock a part rides from."/><span>every movement between complexes</span></div>
    <div className="lgctl"><input placeholder="filter item / complex..." value={f} onChange={e=>setF(e.target.value)}/></div>
    <div className="lgtable"><div className="lgrow lghd"><span>From</span><span>Station</span><span>To</span><span>Item</span><span>/min</span></div>
      {rows.map((x,i)=>(<div className="lgrow" key={i}>
        <span className="lgflow clink" onClick={()=>go(x.from)}>{nm(x.from)}</span>
        <span className={x.station?"mono":"mono dim"}>{x.station?stName(x.from,x.station):"- none -"}</span>
        <span className="lgflow to clink" onClick={()=>go(x.to)}>{nm(x.to)}</span>
        <span>{x.it}</span><span className="mono">{fmt(x.qty)}</span></div>))}
      {!rows.length&&<div className="empty">No flows yet - set input sources on your complexes.</div>}</div>
  </div>);
}


export {Transport};
