import React from 'react';
import {PLAN_GRAPH} from '../lib/data.js';

// classify an item for edge colour
const FLUIDS=new Set(["Water","Crude Oil","Nitrogen Gas","Heavy Oil Residue","Fuel","Turbofuel","Alumina Solution","Sulfuric Acid","Nitric Acid","Dissolved Silica","Rocket Fuel","Ionized Fuel"]);
const isRaw=it=>/(Ore|Coal|Limestone|Sulfur|Bauxite|SAM|Uranium|Raw Quartz)$/.test(it)||it==="Coal";
const edgeColor=it=>FLUIDS.has(it)?"#3aa6d8":isRaw(it)?"#c08a4a":"#6f7b8a";

export function WorldGraph(){
  const g=PLAN_GRAPH;
  const[sel,setSel]=React.useState(null);
  const[showEdges,setShowEdges]=React.useState(true);
  const[minRate,setMinRate]=React.useState(300);
  if(!g||!g.complexes)return <div style={{padding:40,color:"#7f8c99"}}>Run <code>python scripts/engine.py</code> to generate plan_graph.json.</div>;
  const C=g.complexes, E=g.edges;
  // bounds -> viewport
  const xs=C.map(c=>c.x), ys=C.map(c=>c.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const W=1180,H=880,pad=70;
  const px=x=>pad+(x-minX)/(maxX-minX||1)*(W-2*pad);
  const py=y=>pad+(y-minY)/(maxY-minY||1)*(H-2*pad);
  const tot=c=>Object.values(c.makes||{}).reduce((a,b)=>a+b,0);
  const maxTot=Math.max(...C.map(tot),1);
  const rad=c=>7+Math.sqrt(tot(c)/maxTot)*22;
  const domRes=c=>{const e=Object.entries(c.caps||{});return e.length?e.sort((a,b)=>b[1]-a[1])[0][0]:"";};
  const RESCOL={"Iron Ore":"#c94f4f","Copper Ore":"#d98b3a","Coal":"#4a4a55","Limestone":"#b7a86a","Caterium Ore":"#d4b13a","Raw Quartz":"#c86fb0","Bauxite":"#c9a08a","Sulfur":"#d4d24a","SAM":"#6fd4c0","Uranium":"#5fd45f","Crude Oil":"#7a5fd4","Nitrogen Gas":"#5f9fd4"};
  const edges=E.filter(e=>e.rate>=minRate);

  return(<div className="worldgraph" style={{display:"flex",gap:16,height:"100%"}}>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:8,color:"#9aa7b4",font:"12px ui-monospace"}}>
        <b style={{color:"#dfe6ee"}}>Engine world</b>
        <span>{C.length} complexes</span><span>{E.length} edges</span>
        <span>{Math.round(g.stats?.shipped_per_min||0).toLocaleString()}/min shipped</span>
        <label style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
          <input type="checkbox" checked={showEdges} onChange={e=>setShowEdges(e.target.checked)}/>edges</label>
        <label style={{display:"flex",gap:6,alignItems:"center"}}>min {minRate}
          <input type="range" min="0" max="3000" step="100" value={minRate} onChange={e=>setMinRate(+e.target.value)}/></label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"calc(100% - 34px)",background:"#0c1116",borderRadius:8,border:"1px solid #1c2530"}}>
        {showEdges&&edges.map((e,i)=>{const a=C[e.src],b=C[e.dst];if(!a||!b)return null;
          return <line key={i} x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)}
            stroke={edgeColor(e.item)} strokeWidth={Math.max(.4,Math.min(4,e.rate/600))} strokeOpacity={sel==null?.28:(e.src===sel||e.dst===sel?.85:.06)}/>;})}
        {C.map((c,i)=>(<g key={i} onClick={()=>setSel(sel===i?null:i)} style={{cursor:"pointer"}}>
          <circle cx={px(c.x)} cy={py(c.y)} r={rad(c)} fill={RESCOL[domRes(c)]||"#5a6572"}
            stroke={sel===i?"#fff":"#0c1116"} strokeWidth={sel===i?2:1} fillOpacity={sel==null||sel===i?.92:.5}/>
          <text x={px(c.x)} y={py(c.y)-rad(c)-3} textAnchor="middle" fill="#8b98a6" style={{font:"10px ui-monospace",pointerEvents:"none"}}>{c.region}</text>
        </g>))}
      </svg>
    </div>
    <aside style={{width:300,flexShrink:0,overflow:"auto",font:"12px ui-monospace",color:"#c3ccd6"}}>
      {sel==null?<div style={{color:"#7f8c99",padding:"8px 2px"}}>Click a complex to see what it makes, its nodes, and its links. Circle size = production volume; colour = dominant resource.</div>:
      (()=>{const c=C[sel];const makes=Object.entries(c.makes||{}).sort((a,b)=>b[1]-a[1]);
       const ins=edges.filter(e=>e.dst===sel),outs=edges.filter(e=>e.src===sel);
       return<div>
        <div style={{color:"#dfe6ee",fontSize:14,fontWeight:600,marginBottom:2}}>{c.region}</div>
        <div style={{color:"#7f8c99",marginBottom:8}}>({c.x}, {c.y})</div>
        <div style={{color:"#8b98a6",marginBottom:4}}>NODES</div>
        <div style={{marginBottom:10}}>{Object.entries(c.caps||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
          <div key={k} style={{display:"flex",justifyContent:"space-between"}}><span>{k.replace(" Ore","")}</span><span>{Math.round(v)}</span></div>)}</div>
        <div style={{color:"#8b98a6",marginBottom:4}}>MAKES ({makes.length})</div>
        <div style={{marginBottom:10}}>{makes.slice(0,24).map(([k,v])=>
          <div key={k} style={{display:"flex",justifyContent:"space-between"}}><span>{k}</span><span style={{color:"#8b98a6"}}>{Math.round(v)}</span></div>)}</div>
        <div style={{color:"#8b98a6",marginBottom:4}}>IMPORTS ({ins.length})</div>
        <div style={{marginBottom:10}}>{ins.sort((a,b)=>b.rate-a.rate).slice(0,12).map((e,i)=>
          <div key={i} style={{display:"flex",justifyContent:"space-between",color:"#9aa7b4"}}><span>{e.item} &larr; {C[e.src].region}</span><span>{Math.round(e.rate)}</span></div>)}</div>
        <div style={{color:"#8b98a6",marginBottom:4}}>EXPORTS ({outs.length})</div>
        <div>{outs.sort((a,b)=>b.rate-a.rate).slice(0,12).map((e,i)=>
          <div key={i} style={{display:"flex",justifyContent:"space-between",color:"#9aa7b4"}}><span>{e.item} &rarr; {C[e.dst].region}</span><span>{Math.round(e.rate)}</span></div>)}</div>
      </div>;})()}
    </aside>
  </div>);
}
