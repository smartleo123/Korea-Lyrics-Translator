// MusicBrainz public catalog, paginated by a canonical artist identity.
// Catalog metadata is not lyrics. MusicBrainz data is CC0; follow 1 req/sec.
const API="https://musicbrainz.org/ws/2";
const MBID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let lastRequest=0;
let queue=Promise.resolve();
async function throttledRequest(path,{fetcher=fetch,signal}={}){
 const work=async()=>{
  if(signal?.aborted)throw new Error("歌曲查詢已取消");
  const delay=Math.max(0,1100-(Date.now()-lastRequest));
  if(delay)await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{signal?.removeEventListener("abort",cancel);resolve();},delay);
   const cancel=()=>{clearTimeout(timer);reject(new Error("歌曲查詢已取消"));};
   signal?.addEventListener("abort",cancel,{once:true});
  });
  if(signal?.aborted)throw new Error("歌曲查詢已取消");
  lastRequest=Date.now();
  const response=await fetcher(API+path,{signal,headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("MusicBrainz HTTP "+response.status);
  return response.json();
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
