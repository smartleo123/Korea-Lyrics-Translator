// Bounded TTL-aware browser cache. Backwards compatible with legacy simple
// { Korean: Chinese } mappings from earlier website versions.
export function loadCache(storage,key,{ttlDays=90,max=500}={}){
 try{
  const raw=JSON.parse(storage.getItem(key)||"{}");
  const now=Date.now(),ttl=ttlDays*86400000;
  const tuples=Array.isArray(raw?.entries)?
   raw.entries.map(e=>[e.key,e.value,e.time]):
   Object.entries(raw||{}).map(([k,v])=>[k,v,now]);
  const out=Object.create(null);
  for(const [word,meaning,at] of tuples.slice(-max)){
   if(typeof word!=="string"||typeof meaning!=="string"||!word||!meaning||word.length>300||meaning.length>500)continue;
   if(typeof at==="number"&&now-at>ttl)continue;
   out[word]=meaning.replace(/^≈/,"");
  }
  return out;
 }catch{return Object.create(null);}
}
export function saveCache(storage,key,values,{max=500}={}){
 try{
  const now=Date.now();
  const recent=Object.entries(values).filter(([k,v])=>typeof k==="string"&&typeof v==="string"&&k&&v)
    .slice(-max).map(([key,value])=>({key,value,time:now}));
  storage.setItem(key,JSON.stringify({version:2,entries:recent}));
  return true;
 }catch{return false;}
}
