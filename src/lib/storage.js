// Browser-local persistence. Swap this one file for fetch() calls to a server
// when you want friends to share a plan - nothing else touches persistence.
const KEY = k => 'swp:' + k;
export const storage = {
  async get(k){ const v = localStorage.getItem(KEY(k)); return v==null?null:{key:k,value:v}; },
  async set(k,v){ localStorage.setItem(KEY(k), v); return {key:k,value:v}; },
  async delete(k){ localStorage.removeItem(KEY(k)); return {key:k,deleted:true}; },
  async list(prefix=''){ const keys=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(KEY(prefix))) keys.push(k.slice(4)); } return {keys}; }
};
if (typeof window !== 'undefined') window.storage = storage;
