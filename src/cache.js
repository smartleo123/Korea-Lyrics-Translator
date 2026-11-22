// Bounded TTL-aware browser cache with durable insertion timestamps.
// WeakMap keeps the storage metadata separate from the public {key:value} API.
const metadata=new WeakMap();
const DAY_MS=24*60*60*1000;
export function loadCache(storage,key,{ttlDays=90,max=500}={}){
 const out=Object.create(null),times=new Map();
 try{
  const raw=JSON.parse(storage.getItem(key)||"{}");
  if(!raw||typeof raw!=="object")return out;
  const now=Date.now(),ttl=ttlDays*DAY_MS;
  const tuples=Array.isArray(raw.entries)
   ?raw.entries.map(e=>[e?.key,e?.value,e?.time])
   :Object.entries(raw).map(([k,v])=>[k,v,now]);
  for(const [word,meaning,at] of tuples.slice(-max)){
   if(typeof word!=="string"||typeof meaning!=="string"||!word||!meaning||word.length>300||meaning.length>500)continue;
   if(typeof at==="number"&&(!Number.isFinite(at)||at>now||now-at>ttl))continue;
   out[word]=meaning.replace(/^≈/,"");
   times.set(word,typeof at==="number"?at:now);
  }
 }catch{/* Corrupt or inaccessible storage should never block the app. */}
 metadata.set(out,times);
 return out;
}
export function saveCache(storage,key,values,{max=500}={}){
 try{
  const now=Date.now(),previous=metadata.get(values)||new Map();
  const valid=Object.entries(values).filter(([k,v])=>typeof k==="string"&&typeof v==="string"&&k&&v&&k.length<=300&&v.length<=500);
  const entries=valid.slice(-max).map(([key,value])=>({
   key,value,time:previous.get(key)??now
  }));
  storage.setItem(key,JSON.stringify({version:2,entries}));
  metadata.set(values,new Map(entries.map(({key,time})=>[key,time])));
  return true;
 }catch{return false;}
}
