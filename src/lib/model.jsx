import {RECIPES,CAPS,NODESTAT,RESK,PURK,FULLK,NODES,SEED,GOALS,MAPBG,WORLD,MAPS} from './data.js';
import React from 'react';
export const RAW=new Set(["Iron Ore","Copper Ore","Coal","Limestone","Raw Quartz","Bauxite","Caterium Ore","Crude Oil","Sulfur","SAM","Uranium","Nitrogen Gas","Water"]);
export const BP={Smelter:4,Foundry:16,Constructor:4,Assembler:15,Manufacturer:55,Refinery:30,Blender:75,Packager:10,"Particle Accelerator":500,Converter:250,"Quantum Encoder":1000};
export const RMAP=Object.fromEntries(RECIPES.map(r=>[r.n,r]));
export const RNAMES=RECIPES.map(r=>r.n).sort();
export const MODES={train:{label:"Train",per:780,unit:"car"},truck:{label:"Truck",per:240,unit:"truck"},drone:{label:"Drone",per:120,unit:"drone"},belt:{label:"Belt/Pipe",per:780,unit:"belt"}};
export const RESCOL={Iron:"#b3b9c0",Copper:"#e08a4a",Coal:"#6b7280",Limestone:"#c9c2a8",Caterium:"#e2c14a",Quartz:"#e7a6d6",Bauxite:"#d98b6a",Sulfur:"#e2d24a",SAM:"#7ad0c0",Uranium:"#7ad07a",Oil:"#8a7fd0",Nitrogen:"#7fb4d0",Water:"#4f9ecf"};
export function Info({t,w}){return(<span className="info" tabIndex="0"><i>i</i><span className="ibub" style={w?{width:w}:null}>{t}</span></span>);}
export function Tip({t,children,cls}){return(<span className={"tip "+(cls||"")}>{children}<span className="tbub">{t}</span></span>);}
// nodes within radius (metres) of a point; x,y stored in 10-metre units
export function nodesNear(x,y,r){if(x==null||y==null)return[];const rr=(r||300)/10;
  return NODES.filter(n=>{const dx=n[3]-x,dy=n[4]-y;return dx*dx+dy*dy<=rr*rr;});}
export function capNear(x,y,r){const m={};for(const n of nodesNear(x,y,r)){const k=FULLK[RESK[n[0]]];m[k]=(m[k]||0)+n[5];}return m;}
export const MINER={1:60,2:120,3:240},PUR={impure:0.5,normal:1,pure:2},EXTRACTOR={"Crude Oil":120,"Water":120,"Nitrogen Gas":60};
export const fmt=n=>(n==null?"-":Math.abs(n)>=1000?Math.round(n).toLocaleString():(Math.round(n*10)/10).toLocaleString());
export const tierColor=t=>{const n=+String(t).replace(/\D/g,'');return n<=1?"#54c06e":n<=3?"#e2a838":n<=5?"#ff9a3c":n<=7?"#e85d49":"#a06af0";};
export const barColor=p=>p>100?"var(--over)":p>90?"var(--watch)":p>70?"var(--orange)":"var(--ok)";
export const TH=5;
export function nodeRate(nd,item){if(!nd)return 0;const cl=(nd.clock||100)/100;
  const base=EXTRACTOR[item]!=null?EXTRACTOR[item]:(MINER[nd.mk||3]||240);
  return ((nd.impure||0)*PUR.impure+(nd.normal||0)*PUR.normal+(nd.pure||0)*PUR.pure)*base*cl;}
export function maxTarget(step){const r=RMAP[step.recipe];if(!r||!r.o.length)return 0;
  const base=r.o[0][1]||1;let best=null;
  for(const[it,q]of r.i){const nd=(step.nodes||{})[it];
    const cap=nd?nodeRate(nd,it):((step.supply||{})[it]!=null?step.supply[it]:null);
    if(cap==null)continue;const t=cap/(q/base);if(best===null||t<best)best=t;}
  return best===null?0:Math.round(best*100)/100;}
export function computeStep(step){const r=RMAP[step.recipe];
  if(!r)return{machines:0,perIn:[],perOut:[],inputs:[],outputs:[],totIn:0,totOut:0,primary:0,primaryItem:"",power:0,bld:"?",effClock:100,mode:"exact",target:0};
  const base=(r.o[0]&&r.o[0][1])||1,maxCl=(step.clock||100)/100;
  const tgt=step.mode==="max"?maxTarget(step):step.target;
  const machines=tgt>0?Math.ceil(tgt/(base*maxCl)):0;
  let cl=maxCl;if(step.mode!=="full"&&machines>0)cl=tgt/(machines*base);
  const scale=machines*cl;
  const perIn=r.i.map(([it,q])=>[it,q*cl]),perOut=r.o.map(([it,q])=>[it,q*cl]);
  const inputs=perIn.map(([it,q])=>[it,q*machines]),outputs=perOut.map(([it,q])=>[it,q*machines]);
  return{machines,perIn,perOut,inputs,outputs,totIn:inputs.reduce((a,x)=>a+x[1],0),totOut:outputs.reduce((a,x)=>a+x[1],0),
    primary:base*scale,primaryItem:(r.o[0]&&r.o[0][0])||"",power:(BP[r.b]||5)*machines*Math.pow(cl,1.321928),
    bld:r.b,effClock:cl*100,mode:step.mode||"exact",target:tgt};}
export function perItem(c){const m={};for(const s of c.steps){const cs=computeStep(s);
  for(const[it,q]of cs.outputs)(m[it]=m[it]||{made:0,used:0}).made+=q;
  for(const[it,q]of cs.inputs)(m[it]=m[it]||{made:0,used:0}).used+=q;}return m;}
export function allInputs(c){const m=perItem(c);return Object.keys(m).filter(it=>m[it].used>0.01)
  .map(it=>({item:it,used:m[it].used,made:m[it].made,net:m[it].used-m[it].made})).sort((a,b)=>b.net-a.net);}
export const cxMach=c=>c.steps.reduce((a,s)=>a+computeStep(s).machines,0);
export const cxPow=c=>c.steps.reduce((a,s)=>a+computeStep(s).power,0);
export const cxShards=c=>c.steps.reduce((a,s)=>{const x=computeStep(s);return a+x.machines*Math.max(0,Math.ceil((x.effClock-100)/50));},0);
export const cxStatus=c=>{if(!c.steps.length)return c.status||"To Do";
  const d=c.steps.filter(s=>s.status==="done").length,w=c.steps.filter(s=>s.status==="wip").length;
  return d===c.steps.length?"Complete":(d>0||w>0)?"In Progress":"To Do";};
export function computeWorld(cxs){const rawD={},itemD={},itemS={};let mach=0,consume=0,produce=0,done=0,all=0,extPow=0,ext=0;
  for(const c of cxs){if(c.totals){extPow+=c.totals.extPow||0;ext+=c.totals.extBld||0;}
    for(const s of c.steps){all++;if(s.status==="done")done++;const x=computeStep(s);mach+=x.machines;consume+=x.power;
      for(const[it,q]of x.inputs){itemD[it]=(itemD[it]||0)+q;if(RAW.has(it))rawD[it]=(rawD[it]||0)+q;}
      for(const[it,q]of x.outputs){itemS[it]=(itemS[it]||0)+q;if(it==="Power")produce+=q;}}}
  consume+=extPow;
  const scarcity=Object.keys(CAPS).map(k=>({res:k,demand:rawD[k]||0,cap:CAPS[k],pct:(rawD[k]||0)/CAPS[k]*100})).sort((a,b)=>b.pct-a.pct);
  return{scarcity,itemD,itemS,mach,consume,produce,done,all,ext,extPow};}
export function srcList(c,item){const a=(c.sourcesN||{})[item];if(a&&a.length)return a;
  const old=(c.sources||{})[item];return[{from:old||(RAW.has(item)?"raw":""),q:null,station:""}];}
export function computeGraph(cxs){const per={};for(const c of cxs)per[c.id]=perItem(c);
  const oblig={},needs={},worldNet={};
  for(const c of cxs){needs[c.id]=[];const m=per[c.id];
    for(const it in m){const net=m[it].made-m[it].used;worldNet[it]=(worldNet[it]||0)+net;
      if(net<-TH){const rows=srcList(c,it);
        for(const rr of rows){if(rr.from&&rr.from!=="raw"&&rr.from!=="local"){(oblig[rr.from]=oblig[rr.from]||{});
          oblig[rr.from][it]=(oblig[rr.from][it]||0)+(rr.q!=null?rr.q:(-net)/rows.length);}}
        needs[c.id].push({item:it,qty:-net,rows});}}}
  const short={},consumers={};
  for(const pid in oblig)for(const it in oblig[pid]){const a=per[pid]&&per[pid][it]?per[pid][it].made-per[pid][it].used:0;
    const sh=oblig[pid][it]-a;if(sh>TH)(short[pid]=short[pid]||{})[it]=sh;}
  for(const c of cxs)for(const n of needs[c.id])for(const rr of n.rows)
    if(rr.from&&rr.from!=="raw"&&rr.from!=="local"){(consumers[rr.from]=consumers[rr.from]||{});
      (consumers[rr.from][n.item]=consumers[rr.from][n.item]||[]).push({id:c.id,qty:rr.q!=null?rr.q:n.qty/n.rows.length,station:rr.station});}
  const flag={};for(const c of cxs){let f=false;
    for(const n of needs[c.id]){for(const rr of n.rows){if(!rr.from)f=true;else if(short[rr.from]&&short[rr.from][n.item])f=true;}}
    if(short[c.id])f=true;flag[c.id]=f;}
  return{per,needs,short,consumers,flag,worldNet};}

export const PRODBY=(()=>{const m={};for(const r of RECIPES){if(r.o&&r.o.length)(m[r.o[0][0]]=m[r.o[0][0]]||[]).push(r.n);}return m;})();
export const defRecipe=it=>{const l=PRODBY[it]||[];return l.includes(it)?it:(l[0]||null);};
export function solveGoals(targets,choice){choice=choice||{};
  const raw={},steps={},credit={};
  const exp=(item,qty,d,path)=>{
    if(qty<=1e-9||d>40)return;
    if(RAW.has(item)){raw[item]=(raw[item]||0)+qty;return;}
    const rn=choice[item]||defRecipe(item),r=RMAP[rn];
    if(!r||path.has(rn)){raw[item]=(raw[item]||0)+qty;return;}
    const po=r.o.find(o=>o[0]===item);if(!po)return;
    const runs=qty/po[1];steps[rn]=(steps[rn]||0)+runs;
    const np=new Set(path);np.add(rn);
    for(const[it,q]of r.i)exp(it,q*runs,d+1,np);
    for(const[it,q]of r.o)if(it!==item)credit[it]=(credit[it]||0)+q*runs;};
  for(const t of targets)if(t.qty>0)exp(t.item,t.qty,0,new Set());
  let mach=0,pow=0;
  for(const rn in steps){const r=RMAP[rn],m=Math.ceil(steps[rn]);mach+=m;pow+=(BP[r.b]||5)*m;}
  let head=Infinity,bind=null;
  for(const k in raw){if(CAPS[k]&&raw[k]>0){const h=CAPS[k]/raw[k];if(h<head){head=h;bind=k;}}}
  return{raw,steps,credit,mach,pow,head:head===Infinity?null:head,bind};}
// placement scoring: score every node position as a candidate centre
export function scoreSites(need,radius,taken){
  const out=[];const seen=new Set();
  for(const n of NODES){
    const key=Math.round(n[3]/20)+","+Math.round(n[4]/20);
    if(seen.has(key))continue;seen.add(key);
    const cap=capNear(n[3],n[4],radius);
    let cov=0,tot=0,miss=0;
    for(const k in need){tot+=need[k];
      let av=cap[k]||0;
      if(taken&&taken[k])av=Math.max(0,av-(taken[k][key]||0));
      cov+=Math.min(need[k],av);miss+=Math.max(0,need[k]-av);}
    if(!tot)continue;
    out.push({x:n[3],y:n[4],pct:cov/tot*100,miss,cap});}
  out.sort((a,b)=>b.pct-a.pct||a.miss-b.miss);
  return out;}
export const UNLIMITED=new Set(["Water"]);
export function rawNeeds(c){const m=perItem(c),n={};
  for(const it in m)if(RAW.has(it)&&!UNLIMITED.has(it)&&m[it].used>0.01)n[it]=m[it].used;return n;}

export {RECIPES,CAPS,NODESTAT,RESK,PURK,FULLK,NODES,SEED,GOALS,MAPBG,WORLD,MAPS};
