import React from 'react';
import {RECIPES,CAPS,NODESTAT,RESK,PURK,FULLK,NODES,SEED,GOALS,MAPBG,WORLD,MAPS,RAW,BP,RMAP,RNAMES,MODES,MINER,PUR,EXTRACTOR,RESCOL,UNLIMITED,TH,PRODBY,fmt,tierColor,barColor,nodeRate,maxTarget,computeStep,perItem,allInputs,cxMach,cxPow,cxShards,cxStatus,computeWorld,srcList,computeGraph,defRecipe,solveGoals,scoreSites,rawNeeds,capNear,nodesNear,Info,Tip} from '../lib/model.jsx';
function MapView({cxs,up,persist}){
  const[sel,setSel]=React.useState("");
  const[showR,setShowR]=React.useState(true);
  const[recs,setRecs]=React.useState(null);
  const[note,setNote]=React.useState("");
  const[view,setView]=React.useState({k:1,tx:0,ty:0});
  const[drag,setDrag]=React.useState(null);
  const[img,setImg]=React.useState(MAPS[0].url);
  const[mapKey,setMapKey]=React.useState(0);
  const[imgOn,setImgOn]=React.useState(true);
  const[cal,setCal]=React.useState({x:0,y:0,s:1,op:0.85});
  const[terrain,setTerrain]=React.useState(true);
  const[calOpen,setCalOpen]=React.useState(false);
  const[imgErr,setImgErr]=React.useState(false);
  React.useEffect(()=>{(async()=>{try{const r=await window.storage.get("mapimg_v9",true);
    if(r&&r.value){const o=JSON.parse(r.value);if(o.url)setImg(o.url);if(o.cal)setCal(o.cal);if(o.k!=null)setMapKey(o.k);}}catch(e){}})();},[]);
  const saveImg=async(url,c2,k)=>{setImg(url);if(c2)setCal(c2);if(k!=null)setMapKey(k);
    try{await window.storage.set("mapimg_v9",JSON.stringify({url:url,cal:c2||cal,k:k!=null?k:mapKey}),true);}catch(e){}};
  const mnX=Math.min(MAPBG.x0,WORLD.x0),mxX=Math.max(MAPBG.x1,WORLD.x1);
  const mnY=Math.min(MAPBG.y0,WORLD.y0),mxY=Math.max(MAPBG.y1,WORLD.y1);
  const W=960,H=Math.round(960*(mxY-mnY)/(mxX-mnX)),sc=W/(mxX-mnX);
  const sx=v=>(v-mnX)*sc,sy=v=>(v-mnY)*sc;
  const gcw=(MAPBG.x1-MAPBG.x0)/MAPBG.gw,gch=(MAPBG.y1-MAPBG.y0)/MAPBG.gh;
  const bg=React.useMemo(()=>{const out=[];
    for(let gy=0;gy<MAPBG.gh;gy++)for(let gx=0;gx<MAPBG.gw;gx++){
      const ch=MAPBG.grid[gy*MAPBG.gw+gx];if(ch===".")continue;
      const i="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(ch);
      out.push(<rect key={gy+"_"+gx} x={sx(MAPBG.x0+gx*gcw)} y={sy(MAPBG.y0+gy*gch)}
        width={gcw*sc+0.6} height={gch*sc+0.6} fill={MAPBG.cols[i]||"#33403a"}/>);}
    return out;},[]);
  const placed=cxs.filter(c=>c.site&&c.site.x!=null);
  const selCx=cxs.find(c=>c.id===sel);
  const recommend=()=>{if(!selCx)return;const need=rawNeeds(selCx);
    if(!Object.keys(need).length){setNote(selCx.name+" uses no raw nodes - place it anywhere convenient.");setRecs(null);return;}
    const r=(selCx.site&&selCx.site.r)||300;
    const list=scoreSites(need,r).slice(0,60);
    const keep=[];
    for(const s of list){if(keep.every(k=>Math.hypot(k.x-s.x,k.y-s.y)*10>r*1.5))keep.push(s);if(keep.length>=5)break;}
    setRecs({cid:selCx.id,list:keep});
    const best=keep[0];
    setNote(best&&best.pct>99.5?"Found "+keep.length+" spots that fully supply "+selCx.name+" within "+r+" m."
      :best?"Best spot covers "+Math.round(best.pct)+"% of "+selCx.name+" needs at "+r+" m. Widen the reach, or split this complex - see below.":"No suitable spot found.");};
  const autoPlace=()=>{
    // exclusive node allocation: a node claimed by one complex cannot be used by another
    const claimed=new Set();
    const capFree=(x,y,r)=>{const m={};for(const n of nodesNear(x,y,r)){const id=n[3]+"_"+n[4]+"_"+n[0];
      if(claimed.has(id))continue;const k=FULLK[RESK[n[0]]];m[k]=(m[k]||0)+n[5];}return m;};
    const claim=(x,y,r,need)=>{const got={};
      const list=nodesNear(x,y,r).filter(n=>!claimed.has(n[3]+"_"+n[4]+"_"+n[0]))
        .sort((a,b)=>b[5]-a[5]);
      for(const n of list){const k=FULLK[RESK[n[0]]];
        if(!need[k])continue;
        if((got[k]||0)>=need[k])continue;
        claimed.add(n[3]+"_"+n[4]+"_"+n[0]);got[k]=(got[k]||0)+n[5];}
      return got;};
    const order=[...cxs].sort((a,b)=>{
      const sa=Object.values(rawNeeds(a)).reduce((x,y)=>x+y,0),sb=Object.values(rawNeeds(b)).reduce((x,y)=>x+y,0);
      const scarce=o=>{const n=rawNeeds(o);let w=0;for(const k in n)w+=n[k]/(CAPS[k]||1e9);return w;};
      return scarce(b)-scarce(a)||sb-sa;});
    const out={},short=[];
    for(const c2 of order){const need=rawNeeds(c2);
      if(!Object.keys(need).length){out[c2.id]=c2.site||null;continue;}
      const r=(c2.site&&c2.site.r)||600;
      let best=null,bestPct=-1;const seen=new Set();
      for(const n of NODES){const key=Math.round(n[3]/25)+","+Math.round(n[4]/25);
        if(seen.has(key))continue;seen.add(key);
        const cap=capFree(n[3],n[4],r);
        let cov=0,tot=0;
        for(const k in need){tot+=need[k];cov+=Math.min(need[k],cap[k]||0);}
        if(!tot)continue;const pct=cov/tot;
        if(pct>bestPct){bestPct=pct;best={x:n[3],y:n[4]};}
        if(pct>=0.9999)break;}
      if(best){const got=claim(best.x,best.y,r,need);
        out[c2.id]={x:best.x,y:best.y,r};
        if(bestPct<0.999)short.push({n:c2.name,pct:Math.round(bestPct*100),
          miss:Object.keys(need).filter(k=>(got[k]||0)<need[k]-0.5)});}
      else out[c2.id]=null;}
    persist(cxs.map(c2=>({...c2,site:out[c2.id]||null})));
    setNote(short.length
      ? "Placed all "+cxs.length+" complexes on exclusive nodes (no two share a node). "+short.length+
        " cannot be fully fed from one spot - split these or widen reach: "+
        short.slice(0,5).map(s=>s.n+" ("+s.pct+"%, short "+s.miss.join("/")+")").join("; ")
      : "Placed all "+cxs.length+" complexes on exclusive nodes - every one fully fed from its own location.");};
  const onWheel=e=>{e.preventDefault();const r=e.currentTarget.getBoundingClientRect();
    const mx=(e.clientX-r.left)/r.width,my=(e.clientY-r.top)/r.height;
    setView(v=>{const nk=Math.min(12,Math.max(1,v.k*(e.deltaY<0?1.18:1/1.18)));
      const W2=W,H2=H;const wx=(mx*W2-v.tx)/v.k,wy=(my*H2-v.ty)/v.k;
      return{k:nk,tx:mx*W2-wx*nk,ty:my*H2-wy*nk};});};
  const onDown=e=>{if(e.button!==0)return;setDrag({x:e.clientX,y:e.clientY,tx:view.tx,ty:view.ty,moved:false});};
  const onMove=e=>{if(!drag)return;const r=e.currentTarget.getBoundingClientRect();
    const dx=(e.clientX-drag.x)/r.width*W,dy=(e.clientY-drag.y)/r.height*H;
    if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
    setView(v=>({...v,tx:drag.tx+dx,ty:drag.ty+dy}));};
  const onUp=()=>setDrag(null);
  const click=e=>{if(drag&&drag.moved)return;if(!selCx)return;const r=e.currentTarget.getBoundingClientRect();
    const px=((e.clientX-r.left)/r.width*W-view.tx)/view.k,py=((e.clientY-r.top)/r.height*H-view.ty)/view.k;
    up(selCx.id,x=>({...x,site:{x:Math.round(px/sc+mnX),y:Math.round(py/sc+mnY),r:(x.site&&x.site.r)||300}}));};
  return(<div>
    <div className="mh"><h1>Map & placement <Info w="330px" t="Every resource node in the game, at true coordinates. There is no grid or cluster rule - pick a complex, click anywhere to drop it, then set how far its belts/trucks reach. The app totals whatever nodes fall inside that reach."/></h1>
      <p>All {NODES.length} nodes. Choose a complex, click the map to place it, then drag its reach to whatever distance suits the build. Nothing is pre-grouped.</p></div>
    <div className="mapctl">
      <select className="dsel" value={sel} onChange={e=>setSel(e.target.value)}>
        <option value="">select a complex to place...</option>{cxs.map(c=><option key={c.id} value={c.id}>{c.name}{c.site&&c.site.x!=null?" (placed)":""}</option>)}</select>
      {selCx&&<>
        <span className="mono dim">{selCx.site&&selCx.site.x!=null?"at "+selCx.site.x*10+", "+selCx.site.y*10+" m":"click the map to place"}</span>
        {selCx.site&&selCx.site.x!=null&&<><label className="rlab">reach<input type="range" min="100" max="4000" step="50" value={selCx.site.r||300}
          onChange={e=>up(selCx.id,x=>({...x,site:{...x.site,r:+e.target.value}}))}/>
          <input className="qin" type="number" value={selCx.site.r||300} onChange={e=>up(selCx.id,x=>({...x,site:{...x.site,r:+e.target.value||300}}))}/>m</label>
          <button className="addrow" onClick={()=>up(selCx.id,x=>({...x,site:null}))}>clear placement</button></>}</>}
      {selCx&&<button className="addrow fit" onClick={recommend}>recommend locations</button>}
      <button className="addrow fit" onClick={autoPlace}>auto-place every complex <Info t="Places all complexes greedily, largest resource demand first, avoiding double-claiming the same nodes. Anything that cannot be fed from a single spot is flagged as a split candidate."/></button>
      <label className="rlab"><input type="checkbox" checked={showR} onChange={e=>setShowR(e.target.checked)}/>reach rings</label>
      <label className="rlab"><input type="checkbox" checked={terrain} onChange={e=>setTerrain(e.target.checked)}/>terrain</label>
      {img&&<label className="rlab"><input type="checkbox" checked={imgOn} onChange={e=>setImgOn(e.target.checked)}/>map image</label>}
      <button className="addrow" onClick={()=>setView({k:1,tx:0,ty:0})}>reset view</button>
      <button className="addrow" onClick={()=>setCalOpen(o=>!o)}>map image <Info w="340px" t="Paste a URL to a Satisfactory map image you have the right to use - your own screenshot, or an image you host. Then nudge offset, scale and opacity until the resource dots sit on their real terrain. It is stored with your plan."/></button>
    </div>
    {calOpen&&<div className="calpanel">
      <div className="calrow"><label>Map</label>
        {MAPS.map((m,i)=>(<button key={i} className={"addrow"+(mapKey===i?" fit":"")} onClick={()=>saveImg(m.url,{...cal,x:0,y:0,s:1},i)}>{m.name}</button>))}
        <span className="calcred">Official Satisfactory Wiki, CC BY-NC-SA 4.0</span></div>
      <div className="calrow"><label>Or URL</label>
        <input className="calurl" placeholder="https://... your own map image" value={img||""} onChange={e=>saveImg(e.target.value,cal,-1)}/>
        {img&&<button className="x" onClick={()=>saveImg("",cal,-1)}>x</button>}</div>
      <div className="calrow"><label>Offset X</label><input type="range" min="-600" max="600" value={cal.x} onChange={e=>saveImg(img,{...cal,x:+e.target.value})}/><span className="mono">{cal.x}</span>
        <label>Offset Y</label><input type="range" min="-600" max="600" value={cal.y} onChange={e=>saveImg(img,{...cal,y:+e.target.value})}/><span className="mono">{cal.y}</span></div>
      <div className="calrow"><label>Scale</label><input type="range" min="0.3" max="2.5" step="0.005" value={cal.s} onChange={e=>saveImg(img,{...cal,s:+e.target.value})}/><span className="mono">{cal.s.toFixed(3)}</span>
        <label>Opacity</label><input type="range" min="0.1" max="1" step="0.05" value={cal.op} onChange={e=>saveImg(img,{...cal,op:+e.target.value})}/><span className="mono">{cal.op.toFixed(2)}</span></div>
      <div className="calhint">The map is georeferenced to the world bounds ({WORLD.x0*10} to {WORLD.x1*10} m east-west, {WORLD.y0*10} to {WORLD.y1*10} m north-south), so it should already line up. Nudge only if needed - you are moving the picture, never the data.</div>
    </div>}
    {imgErr&&img&&<div className="mapnote err">Map image failed to load - the host is probably blocking hotlinking. Save the image, host your own copy (GitHub raw works), and paste that URL under "map image". Generated terrain is shown meanwhile.</div>}
    {note&&<div className="mapnote">{note}</div>}
    <div className="mapwrap"><svg viewBox={"0 0 "+W+" "+H} className={"mapsvg"+(selCx?" placing":"")+(drag?" grabbing":"")} onClick={click} onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
      <defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter></defs>
      <rect x="0" y="0" width={W} height={H} fill="#0c1f2b"/>
      <g transform={"translate("+view.tx+","+view.ty+") scale("+view.k+")"}>
      {img&&imgOn&&<image href={img} xlinkHref={img} onError={()=>setImgErr(true)} onLoad={()=>setImgErr(false)}
        x={sx(WORLD.x0)+cal.x} y={sy(WORLD.y0)+cal.y}
        width={(WORLD.x1-WORLD.x0)*sc*cal.s} height={(WORLD.y1-WORLD.y0)*sc*cal.s}
        opacity={cal.op} preserveAspectRatio="none"/>}
      {terrain&&<g filter="url(#soft)" opacity={img&&imgOn?0.35:0.95}>{bg}</g>}
      {terrain&&<g opacity="0.55">{MAPBG.anchors.map((a,i)=>(<text key={i} x={sx(a.x)} y={sy(a.y)} fill="#8ea3b0" fontSize={10.5/view.k}
        textAnchor="middle" fontWeight="600">{a.n}</text>))}</g>}
      {[0,1,2,3,4,5,6,7,8].map(i=><line key={"g"+i} x1={W/8*i} y1="0" x2={W/8*i} y2={H} stroke="#ffffff" opacity="0.045"/>)}
      {[0,1,2,3,4,5,6,7].map(i=><line key={"h"+i} x1="0" y1={H/7*i} x2={W} y2={H/7*i} stroke="#ffffff" opacity="0.045"/>)}
      {NODES.map((n,i)=>{const col=RESCOL[RESK[n[0]]]||"#7f8c99";const rad=(n[2]===2?2.2:(n[1]===2?4:n[1]===1?3.2:2.4))/Math.max(1,view.k*0.55);
        return <circle key={i} cx={sx(n[3])} cy={sy(n[4])} r={rad} fill={col} stroke="#0a0f13" strokeWidth={0.5/view.k} opacity={n[1]===2?1:n[1]===1?.85:.62}/>;})}
      {showR&&placed.map(c=>(<circle key={c.id} cx={sx(c.site.x)} cy={sy(c.site.y)} r={(c.site.r||300)/10*sc}
        fill="rgba(255,154,60,.07)" stroke={c.id===sel?"#ff9a3c":"rgba(255,154,60,.5)"} strokeWidth={c.id===sel?2:1} strokeDasharray={c.id===sel?"":"4 3"}/>))}
      {recs&&recs.list.map((s,i)=>(<g key={"r"+i} onClick={ev=>{ev.stopPropagation();up(recs.cid,x=>({...x,site:{x:s.x,y:s.y,r:(x.site&&x.site.r)||300}}));}} style={{cursor:"pointer"}}>
        <circle cx={sx(s.x)} cy={sy(s.y)} r={((selCx&&selCx.site&&selCx.site.r)||300)/10*sc} fill="rgba(84,192,110,.10)" stroke="#54c06e" strokeWidth="2" strokeDasharray="6 4"/>
        <circle cx={sx(s.x)} cy={sy(s.y)} r="12" fill="#54c06e" opacity=".9"/>
        <text x={sx(s.x)} y={sy(s.y)+4} fill="#10151a" fontSize="11" fontWeight="800" textAnchor="middle">{i+1}</text>
        <text x={sx(s.x)} y={sy(s.y)-16} fill="#54c06e" fontSize="10" fontWeight="700" textAnchor="middle">{Math.round(s.pct)}%</text></g>))}
      {placed.map(c=>(<g key={"m"+c.id}><circle cx={sx(c.site.x)} cy={sy(c.site.y)} r="5" fill="#ff9a3c" stroke="#10151a" strokeWidth="1.5"/>
        <text x={sx(c.site.x)} y={sy(c.site.y)-9/view.k} fill="#ff9a3c" fontSize={10.5/view.k} textAnchor="middle" fontWeight="700">{c.name}</text></g>))}
      </g></svg></div>
    <div className="maplegend">{Object.keys(RESCOL).map(k=><span key={k}><i style={{background:RESCOL[k]}}/>{k}</span>)}
      <span className="dim">dot size = purity</span><span className="dim">terrain shading is derived from node distribution and biome anchors, not a game map export</span><span className="dim">Water is not shown or limited - extractors work on any lake, river or ocean edge, so it never constrains placement.</span></div>
    {selCx&&selCx.site&&selCx.site.x!=null&&<Reach c={selCx}/>}
    <div className="secband">PLACED COMPLEXES <span>what each location actually reaches</span></div>
    <div className="cls">{placed.map(c=>{const cap=capNear(c.site.x,c.site.y,c.site.r);
      return(<div className="clcard used" key={c.id}>
        <div className="clhd"><b>{c.name}</b><span className="mono">{c.site.r||300} m reach</span></div>
        <div className="clres">{Object.keys(cap).length?Object.entries(cap).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+":"+fmt(v)).join("  "):"no nodes in reach"}</div></div>);})}
      {!placed.length&&<div className="empty">Nothing placed yet.</div>}</div>
  </div>);
}
function Reach({c}){const cap=capNear(c.site.x,c.site.y,c.site.r);
  const m=perItem(c);const need={};
  for(const it in m){if(RAW.has(it)&&!UNLIMITED.has(it)&&m[it].used>0.01)need[it]=m[it].used;}
  const keys=Array.from(new Set(Object.keys(need).concat(Object.keys(cap))));
  return(<div className="reachbox"><h4>{c.name} - resources in reach vs what it needs <Info t="Green means the nodes inside this reach can supply the complex on their own. Red means you must extend the reach, move the site, or ship that item in."/></h4>
    <div className="reachgrid">{keys.map(k=>{const have=cap[k]||0,want=need[k]||0,ok=have>=want-0.5;
      return(<div className={"rch "+(want?(ok?"ok":"bad"):"idle")} key={k}>
        <b>{k}</b><span>{fmt(have)} in reach</span>{want?<em>needs {fmt(want)}</em>:<em>unused here</em>}</div>);})}
      {!keys.length&&<div className="empty">No raw inputs.</div>}</div></div>);
}

export {MapView};
export {Reach};
