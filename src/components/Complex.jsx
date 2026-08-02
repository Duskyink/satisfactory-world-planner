import React from 'react';
import {RECIPES,CAPS,NODESTAT,RESK,PURK,FULLK,NODES,SEED,GOALS,MAPBG,WORLD,MAPS,RAW,BP,RMAP,RNAMES,MODES,MINER,PUR,EXTRACTOR,RESCOL,UNLIMITED,TH,PRODBY,fmt,tierColor,barColor,nodeRate,maxTarget,computeStep,perItem,allInputs,cxMach,cxPow,cxShards,cxStatus,computeWorld,srcList,computeGraph,defRecipe,solveGoals,scoreSites,rawNeeds,capNear,nodesNear,Info,Tip} from '../lib/model.jsx';
import {RecipePicker} from './Ui.jsx';
function Complex({c,kids,graph,nm,go,cxs,stName,producersOf,consumersNeeding,editStep,addStep,delStep,up,setSrcRows,setDestRows,addStation,editStation,delStation,addSub,del}){
  const t=c.totals||{},m=graph.per[c.id]||{};
  const mach=cxMach(c),pow=cxPow(c),shards=cxShards(c),st=cxStatus(c);
  const ins=allInputs(c);
  const outs=Object.keys(m).filter(it=>m[it].made>0.01&&it!=="Power").map(it=>({it,made:m[it].made,net:m[it].made-m[it].used})).sort((a,b)=>b.made-a.made);
  const groups=[];let cur=null;
  c.steps.forEach(s=>{const sec=s.sec||"PRODUCTION";if(!cur||cur.sec!==sec){cur={sec,items:[]};groups.push(cur);}cur.items.push(s);});
  const dRows=it=>((c.dests||{})[it]||[{to:"",q:null,station:""}]);
  const sRows=it=>{const a=(c.sourcesN||{})[it];return a&&a.length?a:[{from:RAW.has(it)?"raw":"",q:null,station:""}];};
  const stationsOf=cid=>{const x=cxs.find(y=>y.id===cid);return x?(x.stations||[]):[];};
  return(<div>
    <div className="cxhd"><div style={{minWidth:0,flex:1}}>
      <div className="cxtitle"><input className="cxname" value={c.name} onChange={e=>up(c.id,x=>({...x,name:e.target.value}))}/>
        <select className="tiersel" style={{color:tierColor(c.tier),borderColor:tierColor(c.tier)}} value={c.tier||"T?"} onChange={e=>up(c.id,x=>({...x,tier:e.target.value}))}>
          {["T?","T0","T1","T2","T3","T4","T5","T6","T7","T8","T9"].map(x=><option key={x} value={x}>{x}</option>)}</select>
        <span className={"stbadge "+(st==="Complete"?"done":st==="In Progress"?"act":"todo")}>{st}</span></div>
      <textarea className="cxdesc" rows="2" placeholder="what this place is and why it is here" value={c.desc||""} onChange={e=>up(c.id,x=>({...x,desc:e.target.value}))}/>
      <div className="cxsub">
        <label>MAKES<input className="tagin" placeholder="e.g. steel pipe, encased beam" value={c.tags||""} onChange={e=>up(c.id,x=>({...x,tags:e.target.value}))}/></label>
        <label>SITE<Info t="A free-text label for where this sits (biome, landmark, your own name). Actual placement and resource reach is set on the Map tab."/>
          <input className="cxregion" placeholder="unassigned" value={c.region||""} onChange={e=>up(c.id,x=>({...x,region:e.target.value}))}/>
          {c.site&&c.site.x!=null&&<span className="placedchip" title="placed on the map">placed / {c.site.r||300}m reach</span>}</label>
        <label>BUILD STEP<input className="bin2" value={c.bstep||""} placeholder="1.1" onChange={e=>up(c.id,x=>({...x,bstep:e.target.value}))}/></label>
      </div>
      <div className="cxstats"><span>{mach} machines</span><i/><span className={pow<0?"ok":""}>{fmt(pow)} MW</span><i/><span>{shards} shards</span>
        {t.extBld!=null&&<><i/><span>{t.extBld} extractors</span></>}</div>
    </div><div className="cxact"><button onClick={addSub}>+ sub-complex</button><button onClick={addStation}>+ station</button><button className="del" onClick={del}>remove</button></div></div>

    <div className="secband">STATIONS <Info w="330px" t="Create a named dock (e.g. \u2018Steel Pipe Out\u2019), set its vehicle and how many cars, then attach items. Outputs and inputs elsewhere can then route via this station by name."/><span>name each dock so parts can be routed by name</span></div>
    <div className="stlist">{(c.stations||[]).map(s=>(<div className="stcard" key={s.id}>
      <input className="stname" value={s.name} onChange={e=>editStation(c.id,s.id,{name:e.target.value})}/>
      <select value={s.mode||"train"} onChange={e=>editStation(c.id,s.id,{mode:e.target.value})}>{Object.keys(MODES).map(k=><option key={k} value={k}>{MODES[k].label}</option>)}</select>
      <div className="clk"><input type="number" value={s.cars||4} onChange={e=>editStation(c.id,s.id,{cars:+e.target.value||1})}/><em>{MODES[s.mode||"train"].unit}s</em></div>
      <select value="" onChange={e=>{if(e.target.value)editStation(c.id,s.id,{items:[...(s.items||[]),e.target.value]});}}>
        <option value="">+ item...</option>{outs.filter(o=>!(s.items||[]).includes(o.it)).map(o=><option key={o.it} value={o.it}>{o.it}</option>)}</select>
      <div className="titems">{(s.items||[]).map((it,j)=><span key={j} className="titem" onClick={()=>editStation(c.id,s.id,{items:(s.items||[]).filter(y=>y!==it)})}>{it} x</span>)}</div>
      <button className="x" onClick={()=>delStation(c.id,s.id)}>x</button></div>))}
      {!(c.stations||[]).length&&<div className="empty">No stations yet - add one to route parts by name.</div>}</div>

    <div className="secband">OUTPUTS <Info w="330px" t="Everything produced here. Spare is what is left after this complex consumes its own output. Add a destination per part - quantity, where it goes, and optionally which station it leaves from."/><span>what this makes and where each part goes</span></div>
    <div className="tblwrap"><div className="otbl">
      <div className="orow ohead"><span>Item</span><span>Made /min</span><span>Spare</span><span>Destinations</span></div>
      {outs.map((o,i)=>{const rows=dRows(o.it);
        return(<div className="orow" key={i}>
          <span className="oitem">{o.it}</span><span className="mono">{fmt(o.made)}</span>
          <span className="mono dim">{o.net>0.5?fmt(o.net):"0"}</span>
          <span className="rowset">{rows.map((d,k)=>(<span className="rowline" key={k}>
            <input className="qin" type="number" placeholder="qty" value={d.q!=null?d.q:""} onChange={e=>{const r=[...rows];r[k]={...d,q:e.target.value===""?null:+e.target.value};setDestRows(c.id,o.it,r);}}/>
            <select className="dsel" value={d.to} onChange={e=>{const r=[...rows];r[k]={...d,to:e.target.value,station:""};setDestRows(c.id,o.it,r);}}>
              <option value="">- destination -</option><option value="depot">Central Depot</option><option value="onsite">used on site</option>
              {cxs.filter(x=>x.id!==c.id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <select className="dsel st" value={d.station||""} onChange={e=>{const r=[...rows];r[k]={...d,station:e.target.value};setDestRows(c.id,o.it,r);}}>
              <option value="">via station...</option>{(c.stations||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
            {rows.length>1&&<button className="x sm" onClick={()=>setDestRows(c.id,o.it,rows.filter((_,j)=>j!==k))}>x</button>}
          </span>))}
          <button className="addrow" onClick={()=>setDestRows(c.id,o.it,[...rows,{to:"",q:null,station:""}])}>+ destination</button></span></div>);})}
      {!outs.length&&<div className="empty">No outputs.</div>}
    </div></div>

    <div className="secband">INPUTS <Info w="340px" t="Everything consumed here. \u2018Made here\u2019 is produced on site by an earlier step; \u2018Ship in\u2019 is the shortfall you must bring in. Add as many sources as you need - a node, another complex, or a mix."/><span>where each part comes from</span></div>
    <div className="tblwrap"><div className="itbl">
      <div className="irow ihead"><span>Item</span><span>Used /min</span><span>Made here</span><span>Ship in</span><span>Sources</span></div>
      {ins.map((n,i)=>{const rows=sRows(n.item);const none=rows.some(r=>!r.from);
        return(<div className={"irow"+(none&&n.net>TH?" bad":"")} key={i}>
          <span className="oitem">{n.item}</span><span className="mono">{fmt(n.used)}</span>
          <span className="mono dim">{n.made>0.5?fmt(n.made):"-"}</span>
          <span className="mono">{n.net>0.5?fmt(n.net):"0"}</span>
          <span className="rowset">{rows.map((r,k)=>{const sh=r.from&&r.from!=="raw"&&graph.short[r.from]&&graph.short[r.from][n.item];
            return(<span className="rowline" key={k}>
              <input className="qin" type="number" placeholder="qty" value={r.q!=null?r.q:""} onChange={e=>{const a=[...rows];a[k]={...r,q:e.target.value===""?null:+e.target.value};setSrcRows(c.id,n.item,a);}}/>
              <select className="dsel" value={r.from} onChange={e=>{const a=[...rows];a[k]={...r,from:e.target.value,station:""};setSrcRows(c.id,n.item,a);}}>
                <option value="">- source -</option><option value="raw">Extracted on site (node)</option><option value={c.id}>{c.name} (made here)</option>
                {cxs.filter(x=>x.id!==c.id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <select className="dsel st" value={r.station||""} onChange={e=>{const a=[...rows];a[k]={...r,station:e.target.value};setSrcRows(c.id,n.item,a);}}>
                <option value="">via station...</option>{stationsOf(r.from).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
              {sh?<i className="stbad">short {fmt(sh)}</i>:null}
              {rows.length>1&&<button className="x sm" onClick={()=>setSrcRows(c.id,n.item,rows.filter((_,j)=>j!==k))}>x</button>}
            </span>);})}
          <button className="addrow" onClick={()=>setSrcRows(c.id,n.item,[...rows,{from:"",q:null,station:""}])}>+ source</button></span></div>);})}
      {!ins.length&&<div className="empty">No inputs.</div>}
    </div></div>

    <div className="secband">PRODUCTION FLOW <Info w="360px" t="Each row is one recipe. Target is the rate you want of its main product; machines and all inputs follow. Modes: EXACT trims the clock so output lands exactly on target; FULL runs every machine at your clock and overshoots; MAX computes the target from nodes you assign. Status rolls up to the complex automatically."/><span>top to bottom = production order</span></div>
    <div className="tblwrap"><div className="ptbl">
      <div className="prow2 phead2">
        <Tip t="Click to cycle: to do, in progress, done. Rolls up to the complex status."><span>Status</span></Tip>
        <Tip t="Your label for this step, e.g. 'Iron Ingot (local)'."><span>Step</span></Tip>
        <span>Building</span>
        <Tip t="Maximum clock. In EXACT mode the real clock is trimmed below this to hit the target precisely."><span>Clock</span></Tip>
        <span>Recipe</span>
        <Tip t="Rate you want of this recipe's main product. Machines and inputs are derived from it."><span>Target /min</span></Tip>
        <Tip t="Whole machines needed."><span>Mach</span></Tip>
        <Tip t="Actual output of the main product. Byproducts are listed separately beneath."><span>Primary OUT</span></Tip>
        <Tip t="Left number is one machine's rate at the running clock; after the equals sign is the total across all machines." cls="divcol"><span>In per machine = total</span></Tip>
        <Tip t="Same for outputs: one machine, then the total."><span>Out per machine = total</span></Tip><span/></div>
      {groups.map((g,gi)=>(<React.Fragment key={gi}>
        <div className="psec"><input className="secin" value={g.sec} onChange={e=>{const nv=e.target.value;g.items.forEach(it=>editStep(c.id,it.id,{sec:nv}));}}/></div>
        {g.items.map(s2=>{const cs=computeStep(s2);const rc=RMAP[s2.recipe];
          const setNode=(item,f,v)=>editStep(c.id,s2.id,{nodes:{...(s2.nodes||{}),[item]:{...(((s2.nodes||{})[item])||{mk:3,clock:100}),[f]:v}}});
          const cyc={todo:"wip",wip:"done",done:"todo"};
          return(<React.Fragment key={s2.id}><div className="prow2">
            <button className={"stbtn "+(s2.status||"todo")} title="click to change: to do / in progress / done" onClick={()=>editStep(c.id,s2.id,{status:cyc[s2.status||"todo"]})}>
              {s2.status==="done"?"done":s2.status==="wip"?"WIP":"to do"}</button>
            <input className="nin" value={s2.name||""} placeholder="step name" onChange={e=>editStep(c.id,s2.id,{name:e.target.value})}/>
            <span className="dim small">{cs.bld}</span>
            <div className="clkcell"><div className="clk"><input type="number" value={s2.clock} onChange={e=>editStep(c.id,s2.id,{clock:+e.target.value||100})}/><em>%</em></div>
              <button className={"modebtn "+(cs.mode==="max"?"mx":cs.mode==="full"?"":"on")} onClick={()=>editStep(c.id,s2.id,{mode:cs.mode==="exact"?"full":cs.mode==="full"?"max":"exact"})}
                title={cs.mode==="max"?"MAX: target computed from the nodes below":cs.mode==="full"?"FULL: machines at set clock, output overshoots":"EXACT: clock trimmed to hit target exactly"}>{cs.mode}</button>
              {cs.mode!=="full"&&Math.abs(cs.effClock-(s2.clock||100))>0.05&&<i className="effclk">runs {fmt(cs.effClock)}%</i>}</div>
            <RecipePicker value={s2.recipe} onChange={n=>editStep(c.id,s2.id,{recipe:n})}/>
            {cs.mode==="max"?<span className="tin calc">{fmt(cs.target)}<em>from nodes</em></span>
              :<input className="tin" type="number" value={s2.target} onChange={e=>editStep(c.id,s2.id,{target:+e.target.value||0})}/>}
            <span className="mach">{cs.machines}</span>
            <span className="mono sum out">{fmt(cs.primary)}{cs.totOut-cs.primary>0.5&&<em>+{fmt(cs.totOut-cs.primary)} byprod</em>}</span>
            <span className="iolines divcol">{cs.perIn.map(([it,q],k)=><em key={k}><b>{fmt(q)}</b> {it}<i> = {fmt(q*cs.machines)}</i></em>)}</span>
            <span className="iolines out">{cs.perOut.map(([it,q],k)=><em key={k}><b>{fmt(q)}</b> {it}<i> = {fmt(q*cs.machines)}</i></em>)}</span>
            <button className="x" onClick={()=>delStep(c.id,s2.id)}>x</button></div>
            {cs.mode==="max"&&<div className="noderow"><span className="nlbl">Feed from:</span>
              {(rc?rc.i:[]).map(([it,q])=>{const nd=(s2.nodes||{})[it]||{};const rate=nodeRate(nd,it);
                const lim=rate?rate/(q/((rc.o[0]&&rc.o[0][1])||1)):null;
                return(<span className="ndchip" key={it}><b className={RAW.has(it)?"raw":""}>{it}</b>
                  {RAW.has(it)?<>
                    <label>pure<input type="number" min="0" value={nd.pure||0} onChange={e=>setNode(it,"pure",+e.target.value||0)}/></label>
                    <label>norm<input type="number" min="0" value={nd.normal||0} onChange={e=>setNode(it,"normal",+e.target.value||0)}/></label>
                    <label>imp<input type="number" min="0" value={nd.impure||0} onChange={e=>setNode(it,"impure",+e.target.value||0)}/></label>
                    {EXTRACTOR[it]==null&&<label>Mk<select value={nd.mk||3} onChange={e=>setNode(it,"mk",+e.target.value)}>{[1,2,3].map(mk=><option key={mk} value={mk}>{mk}</option>)}</select></label>}
                    <label>clk<input type="number" min="1" value={nd.clock||100} onChange={e=>setNode(it,"clock",+e.target.value||100)}/>%</label></>
                  :<label>avail<input type="number" min="0" placeholder="/min" value={(s2.supply||{})[it]!=null?s2.supply[it]:""} onChange={e=>editStep(c.id,s2.id,{supply:{...(s2.supply||{}),[it]:e.target.value===""?null:+e.target.value}})}/></label>}
                  <i>{rate?fmt(rate)+"/min":(s2.supply||{})[it]!=null?fmt(s2.supply[it])+"/min":"unset"}{lim!=null?" -> "+fmt(lim):""}</i></span>);})}
              <span className="ndres">max {fmt(cs.target)}/min {cs.primaryItem}</span></div>}
          </React.Fragment>);})}
      </React.Fragment>))}
      {!c.steps.length&&<div className="empty">No steps yet.</div>}
    </div></div>
    <div style={{padding:"0 28px"}}><button className="addstep" onClick={()=>addStep(c.id)}>+ add step</button></div>

    <div className="secband">TOTALS <Info t="Processing power is the machines above. Extraction is miners and pumps - override the count and draw if you want it exact. Negative total power means this complex is a net generator."/></div>
    <div className="ttbl">
      <div className="trow"><span>Machines (processing)</span><b>{mach}</b><em>{fmt(pow)} MW processing power</em></div>
      <div className="trow"><span>Extraction buildings</span><b>{t.extBld!=null?t.extBld:"-"}</b>
        <span className="ovr">count<input className="qin sm" type="number" value={t.extBld!=null?t.extBld:""} onChange={e=>up(c.id,x=>({...x,totals:{...(x.totals||{}),extBld:e.target.value===""?null:+e.target.value}}))}/>
        power<input className="qin sm" type="number" value={t.extPow!=null?t.extPow:""} onChange={e=>up(c.id,x=>({...x,totals:{...(x.totals||{}),extPow:e.target.value===""?null:+e.target.value}}))}/>MW</span></div>
      <div className="trow tot"><span>TOTAL POWER</span><b className={pow+(t.extPow||0)<0?"gen":""}>{fmt(pow+(t.extPow||0))}</b><em>processing + extraction. Negative = net generator</em></div>
      <div className="trow"><span>Power shards</span><b>{shards}</b><em>1 per +50% overclock, per machine</em></div>
      <div className="trow"><span>Progress</span><b>{c.steps.length?Math.round(c.steps.filter(x=>x.status==="done").length/c.steps.length*100):0}%</b>
        <em>{c.steps.filter(x=>x.status==="done").length} done, {c.steps.filter(x=>x.status==="wip").length} in progress, of {c.steps.length}</em></div>
      <div className="trow"><span>Nodes to claim</span><b/><input className="tnote" value={t.nodes||""} placeholder="e.g. 4 pure iron, 2 normal coal" onChange={e=>up(c.id,x=>({...x,totals:{...(x.totals||{}),nodes:e.target.value}}))}/></div>
      <div className="trow"><span>Notes</span><b/><input className="tnote" value={t.sizing||""} placeholder="sizing rationale" onChange={e=>up(c.id,x=>({...x,totals:{...(x.totals||{}),sizing:e.target.value}}))}/></div>
    </div>
    {kids.length>0&&<div className="kidnote">Sub-complexes: {kids.map(k=>k.name).join(", ")}</div>}
  </div>);
}

export {Complex};
