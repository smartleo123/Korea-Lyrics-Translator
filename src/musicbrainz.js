// MusicBrainz public catalog, paginated by a canonical artist identity.
// Catalog metadata is not lyrics. MusicBrainz data is CC0; follow 1 req/sec.
const API="https://musicbrainz.org/ws/2";
const MBID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let lastRequest=0;
let queue=Promise.resolve();
// Keep recent MusicBrainz pages locally; transient 503s should not erase a
// previously loaded discography. Do not cache error responses.
const CACHE_PREFIX="klt-mb-v2:";
const memory=new Map();
const FRESH_MS=12*60*60*1000,STALE_MS=7*24*60*60*1000;
const sleep=(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal?.aborted)return reject(new Error("歌曲查詢已取消"));
 const timer=setTimeout(()=>{signal?.removeEventListener("abort",cancel);resolve();},ms);
 const cancel=()=>{clearTimeout(timer);reject(new Error("歌曲查詢已取消"));};
 signal?.addEventListener("abort",cancel,{once:true});
});
function readCache(path){
 let value=memory.get(path);
 if(!value){
  try{const raw=localStorage.getItem(CACHE_PREFIX+path);if(raw)value=JSON.parse(raw);}catch{}
 }
 if(!value||!Number.isFinite(value.time)||Date.now()-value.time>STALE_MS)return null;
 return value;
}
function storeCache(path,data){
 const value={time:Date.now(),data};
 memory.set(path,value);
 if(memory.size>24)memory.delete(memory.keys().next().value);
 try{
  const str=JSON.stringify(value);
  if(str.length<110000)localStorage.setItem(CACHE_PREFIX+path,str);
 }catch{}
}
async function throttledRequest(path,{fetcher=fetch,signal}={}){
 // Cache only real browser queries, not mocked test calls.
 const useCache=fetcher===fetch;
 const cached=useCache?readCache(path):null;
 if(cached&&Date.now()-cached.time<FRESH_MS)return cached.data;
 const work=async()=>{
  if(signal?.aborted)throw new Error("歌曲查詢已取消");
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
   if(signal?.aborted)throw new Error("歌曲查詢已取消");
   // MusicBrainz permits 1 request/second. Spread retries even more.
   const interval=attempt===0?1100:1300*(attempt+1);
   await sleep(Math.max(0,lastRequest+interval-Date.now()),signal);
   if(signal?.aborted)throw new Error("歌曲查詢已取消");
   lastRequest=Date.now();
   try{
    const response=await fetcher(API+path,{signal,headers:{Accept:"application/json"}});
    if(response.ok){
     const data=await response.json();
     if(useCache)storeCache(path,data);
     return data;
    }
    if(![429,500,502,503,504].includes(response.status))throw new Error("MusicBrainz HTTP "+response.status);
    lastError=new Error("MusicBrainz HTTP "+response.status);
   }catch(err){
    if(signal?.aborted)throw new Error("歌曲查詢已取消");
    // HTTP 4xx (except 429) and invalid JSON should not be repeatedly retried.
    if(/^MusicBrainz HTTP (?!429|50[0234])/.test(err.message||""))throw err;
    lastError=err;
   }
  }
  if(cached)return cached.data;
  throw new Error("音樂資料服務暫時忙碌（可能是 503），自動重試仍失敗。請稍後重試，或直接貼上歌詞。");
 };
 const pending=queue.catch(()=>{}).then(work);
 queue=pending.catch(()=>{});
 return pending;
}
export function normalizeMusicBrainzArtist(entry){
 if(!entry||!MBID.test(entry.id||"")||!entry.name)return null;
 return {id:entry.id,name:entry.name,sortName:entry["sort-name"]||"",
  country:entry.country||"",type:entry.type||"",disambiguation:entry.disambiguation||"",
  aliases:(entry.aliases||[]).map(x=>x.name).filter(x=>typeof x==="string"&&x.trim()).slice(0,30),
  score:Number(entry.score)||0};
}
// Autoselect high-confidence K-pop results; avoid a wall of unrelated
// artists merely because they contain the same letters somewhere.
function cleanName(x){return String(x||"").normalize("NFKC").toLocaleLowerCase().replace(/[^\\p{L}\\p{N}]/gu,"");}
export function rankArtists(artists,query){
 const q=cleanName(query);
 return artists.map(artist=>{
  const name=cleanName(artist.name);
  const aliases=(artist.aliases||[]).map(cleanName);
  const exact=!!q&&(name===q||aliases.includes(q));
  const contains=!!q&&(name.includes(q)||aliases.some(alias=>alias.includes(q)));
  const korean=artist.country==="KR";
  const group=artist.type==="Group"||/korean (?:girl|boy) group|k.?pop|south korean group/i.test(artist.disambiguation||"");
  const score=(exact?1000:contains?100:0)+(korean?90:0)+(group?45:0)+Math.min(100,Number(artist.score)||0);
  return {...artist,matchScore:score,exactName:exact};
 }).sort((a,b)=>b.matchScore-a.matchScore||a.name.localeCompare(b.name));
}
export function recommendedArtist(artists,query){
 const ranked=rankArtists(artists,query);
 if(!ranked.length)return null;
 const top=ranked[0],next=ranked[1];
 // If there is no exact name/alias, keep a user-confirmation flow.
 // A strong exact Korean artist is favored over substring-matching noise.
 if(!top.exactName)return null;
 if(next?.exactName && top.matchScore-next.matchScore<75)return null;
 return top;
}
export async function searchMusicBrainzArtists(name,{fetcher=fetch,signal}={}){
 const term=String(name||"").trim();
 if(!term)return [];
 // Plain Lucene search handles English/Korean artist names and aliases.
 const query=new URLSearchParams({query:term,fmt:"json",limit:"15"});
 const data=await throttledRequest("/artist/?"+query,{fetcher,signal});
 return Array.isArray(data.artists)?data.artists.map(normalizeMusicBrainzArtist).filter(Boolean):[];
}
export function normalizeRecording(entry,artist){
 if(!entry||!entry.id||!entry.title)return null;
 return {id:entry.id,name:entry.title,artist:artist.name,
  artistId:artist.id,album:(entry.releases?.[0]?.title)||"",
  duration:Math.round((Number(entry.length)||0)/1000),
  catalogOnly:true,source:"MusicBrainz"};
}
export function normalizeRecordingPage(data,artist,offset=0){
 const recordings=Array.isArray(data.recordings)?data.recordings:[];
 const total=Number(data["recording-count"]);
 const safeCount=Number.isFinite(total)&&total>=0?total:offset+recordings.length;
 const unique=new Map();
 for(const entry of recordings){
  const track=normalizeRecording(entry,artist);
  if(!track)continue;
  const key=track.name.normalize("NFKC").toLocaleLowerCase().trim();
  if(!unique.has(key))unique.set(key,track);
 }
 return {tracks:[...unique.values()],offset:offset+recordings.length,total:safeCount,
  hasMore:recordings.length>0&&offset+recordings.length<safeCount,
  rawCount:recordings.length};
}
export async function getMusicBrainzRecordingPage(artist,{offset=0,limit=100,fetcher=fetch,signal}={}){
 if(!artist||!MBID.test(artist.id))throw new Error("請先選擇正確的歌手");
 const start=Math.max(0,Math.floor(Number(offset)||0));
 const size=Math.max(1,Math.min(100,Math.floor(Number(limit)||100)));
 const query=new URLSearchParams({artist:artist.id,fmt:"json",limit:String(size),offset:String(start)});
 const data=await throttledRequest("/recording?"+query,{fetcher,signal});
 return normalizeRecordingPage(data,artist,start);
}
// Search recordings by title using the same MusicBrainz catalog as artist
// browsing. LRCLIB is used only after a song is chosen for fetching lyrics.
export async function searchMusicBrainzSongs(title,{artistName="",fetcher=fetch,signal}={}){
 const term=String(title||"").trim();
 if(!term)return [];
 const query=new URLSearchParams({query:term,fmt:"json",limit:"60"});
 const data=await throttledRequest("/recording/?"+query,{fetcher,signal});
 const artistSearch=String(artistName||"").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
 const entries=Array.isArray(data.recordings)?data.recordings:[];
 const output=[],seen=new Set();
 for(const entry of entries){
  const credit=Array.isArray(entry["artist-credit"])?entry["artist-credit"].find(x=>x&&typeof x==="object"&&x.artist):null;
  const name=credit?.artist?.name||credit?.name||"";
  if(!name)continue;
  const normalized=name.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
  if(artistSearch&&!normalized.includes(artistSearch))continue;
  const artist={id:credit.artist.id||"",name,aliases:[]};
  const recording=normalizeRecording(entry,artist);
  if(!recording)continue;
  const key=recording.name.normalize("NFKC").toLocaleLowerCase().trim()+"|"+normalized;
  if(seen.has(key))continue;
  seen.add(key);output.push(recording);
 }
 return output;
}
export function appendUniqueSongs(existing,incoming){
 const map=new Map();
 for(const t of [...existing,...incoming]){
  const key=String(t.name||"").normalize("NFKC").toLocaleLowerCase().trim();
  if(key&&!map.has(key))map.set(key,t);
 }
 return [...map.values()];
}
