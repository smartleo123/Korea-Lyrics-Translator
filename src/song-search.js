// LRCLIB browser API integration: search tracks first, then request selected lyrics.
// Lyrics are never committed to this repository or stored on the server.
const BASE="https://lrclib.net/api";
function safeStr(x){return typeof x==="string"?x:"";}
const recentSearch=new Map();
const SEARCH_CACHE_MS=10*60*1000;
function rememberSearch(key,items){
 recentSearch.set(key,{at:Date.now(),items});
 if(recentSearch.size>30)recentSearch.delete(recentSearch.keys().next().value);
}
function abortError(){return new Error("搜尋已取消");}
// Cancel hung provider requests without introducing additional services.
async function requestJson(url,{fetcher=fetch,signal,timeoutMs=12000}={}){
 if(signal?.aborted)throw abortError();
 const controller=new AbortController();
 const cancel=()=>controller.abort();
 signal?.addEventListener("abort",cancel,{once:true});
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  let response;
  try{response=await fetcher(url,{signal:controller.signal,headers:{Accept:"application/json"}});}
  catch(err){
   if(signal?.aborted)throw abortError();
   if(controller.signal.aborted)throw new Error("LRCLIB 查詢逾時，請重試");
   throw err;
  }
  if(!response.ok){
   if(response.status===429){
    const retry=Number(response.headers?.get?.("Retry-After"));
    throw new Error("LRCLIB 查詢過於頻繁，請"+(Number.isFinite(retry)&&retry>0?"在約 "+retry+" 秒後":"稍後")+"重試（429）");
   }
   throw new Error("LRCLIB 服務暫時無法使用（HTTP "+response.status+"）");
  }
  return await response.json();
 }finally{
  clearTimeout(timer);
  signal?.removeEventListener("abort",cancel);
 }
}
function normalizedArtist(x){return safeStr(x).normalize("NFKC").toLocaleLowerCase().replace(/[\\s\\u00b7\\u2022._\\-()\\[\\]]+/g,"").trim();}
async function runSearch(params,{fetcher=fetch,signal}={}){
 const url=BASE+"/search?"+new URLSearchParams(params);
 const key=url;
 const cached=fetcher===fetch?recentSearch.get(key):null;
 if(cached&&Date.now()-cached.at<SEARCH_CACHE_MS)return cached.items;
 const json=await requestJson(url,{fetcher,signal});
 if(!Array.isArray(json))throw new Error("歌曲搜尋資料格式異常");
 const tracks=json.map(normalizeTrack).filter(Boolean).filter(t=>t.name||t.artist).slice(0,20);
 if(fetcher===fetch)rememberSearch(key,tracks);
 return tracks;
}
export function normalizeTrack(hit){
 if(!hit||hit.id===null||hit.id===undefined||!Number.isSafeInteger(Number(hit.id))||Number(hit.id)<=0)return null;
 return {id:Number(hit.id),name:safeStr(hit.trackName),artist:safeStr(hit.artistName),album:safeStr(hit.albumName),duration:Number(hit.duration)||0,instrumental:!!hit.instrumental};
}
export async function searchTracks(query,{fetcher=fetch,signal}={}){
 const q=String(query||"").trim();
 if(!q)return [];
 return runSearch({q},{fetcher,signal});
}
export async function searchTrackByMetadata(track,artist="",{fetcher=fetch,signal}={}){
 const title=String(track||"").trim(),name=String(artist||"").trim();
 if(!title)return [];
 // Avoid missing a recording because the first 20 generic search hits
 // happened to belong to other artists.
 return runSearch(name?{track_name:title,artist_name:name}:{track_name:title},{fetcher,signal});
}
export async function searchArtistTracks(artist,{fetcher=fetch,signal}={}){
 const name=String(artist||"").trim();
 if(!name)return [];
 const response=await searchTracks(name,{fetcher,signal});
 const normalized=normalizedArtist(name);
 return response.filter(track=>normalizedArtist(track.artist).includes(normalized))
   .sort((a,b)=>{
     const ae=normalizedArtist(a.artist)===normalized,be=normalizedArtist(b.artist)===normalized;
     if(ae!==be)return ae?-1:1;
     return a.name.localeCompare(b.name);
   });
}
function normalizeArtist(str){return normalizedArtist(str);}
export function groupArtistTracks(tracks){
 const result=[],byKey=new Map();
 for(const track of tracks){
  const key=track.name.normalize("NFKC").toLocaleLowerCase().trim()+"\u0000"+normalizeArtist(track.artist);
  if(!byKey.has(key)){
   const group={name:track.name,artist:track.artist,versions:[]};
   byKey.set(key,group);result.push(group);
  }
  byKey.get(key).versions.push(track);
 }
 return result;
}

export function decodeSyncedLyrics(raw){
 const lines=safeStr(raw).replace(/\r\n?/g,"\n").split("\n");
 return lines.map(line=>line.replace(/^\s*\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]\s*/,""))
  .filter(line=>!/^\[(?:ar|al|ti|by|offset|length):/i.test(line))
  .join("\n").trim();
}
/**
 * LRCLIB can contain English translations or romanized transcriptions for
 * Korean tracks. Use the actual lyric script, never the song title language.
 * Mixed Korean/English lyrics are acceptable if Korean text is substantial.
 */
export function inspectLyricLanguage(raw){
 const text=safeStr(raw).replace(/\[[^\]\n]{1,80}\]/g,"").replace(/\([^\)\n]{1,30}\)/g,"");
 const korean=(text.match(/[가-힣]/g)||[]).length;
 const latin=(text.match(/[a-zA-Z]/g)||[]).length;
 const letters=korean+latin;
 const ratio=letters?korean/letters:0;
 const meaningfulLines=text.split(/\r?\n/).filter(line=>/[가-힣a-zA-Z]{2}/.test(line));
 const koreanLines=meaningfulLines.filter(line=>(line.match(/[가-힣]/g)||[]).length>=3).length;
 const lineRatio=meaningfulLines.length?koreanLines/meaningfulLines.length:0;
 // Reject English/romanized covers with one incidental Hangul heading.
 const isKorean=korean>=4&&ratio>=0.1&&koreanLines>=1
   &&(meaningfulLines.length<=3||lineRatio>=0.2)
   &&(letters<180||korean>=12||koreanLines>=2);
 return {isKorean,korean,latin,ratio,koreanLines,lineRatio};
}
export function chooseKoreanLyrics(record){
 const candidates=[
  {text:safeStr(record?.plainLyrics).trim(),kind:"plain"},
  {text:decodeSyncedLyrics(record?.syncedLyrics),kind:"synced"}
 ].filter(candidate=>candidate.text);
 const korean=candidates.filter(x=>inspectLyricLanguage(x.text).isKorean);
 // Preserve original unsynchronized paragraph structure whenever it is Korean.
 return korean.find(x=>x.kind==="plain")||korean[0]||null;
}
export async function getLyricsForTrack(id,{fetcher=fetch,signal}={}){
 if(id===null||id===undefined||!Number.isSafeInteger(Number(id))||Number(id)<1)throw new Error("無效的曲目 ID");
 const x=await requestJson(BASE+"/get/"+Number(id),{fetcher,signal});
 if(x.instrumental)throw new Error("這個版本是純音樂，沒有韓文歌詞");
 const selected=chooseKoreanLyrics(x);
 if(!selected){
  const hasLyrics=safeStr(x.plainLyrics).trim()||safeStr(x.syncedLyrics).trim();
  throw new Error(hasLyrics?"此版本提供的是英文／羅馬拼音歌詞，未找到足夠韓文內容":"這個版本沒有可用的文字歌詞");
 }
 return {lyrics:selected.text,track:normalizeTrack(x),source:"LRCLIB",lyricKind:selected.kind};
}
/**
 * If a selected LRCLIB version is romanized/English, check other recordings
 * of the same song. Never silently substitute another artist or song title.
 */
export async function getKoreanLyricsWithFallback(track,versions=[],{fetcher=fetch,signal,searcher=searchTracks}={}){
 const variants=[track,...versions].filter(Boolean);
 const seen=new Set(),candidates=[];
 const add=candidate=>{
  if(!candidate||seen.has(candidate.id)||normalizeArtist(candidate.artist)!==normalizeArtist(track.artist)||candidate.name.normalize("NFKC").toLowerCase().trim()!==track.name.normalize("NFKC").toLowerCase().trim())return;
  seen.add(candidate.id);candidates.push(candidate);
 };
 variants.forEach(add);
 let lastError;
 async function tryCandidates(){
  for(const candidate of candidates){
   if(signal?.aborted)throw new Error("搜尋已取消");
   if(candidate.instrumental)continue;
   try{
    const found=await getLyricsForTrack(candidate.id,{fetcher,signal});
    return {...found,usedAlternative:candidate.id!==track.id};
   }catch(err){
    if(signal?.aborted)throw err;
    lastError=err;
   }
  }
  return null;
 }
 const first=await tryCandidates();
 if(first)return first;
 // Retry a focused lookup when the original broad search gave only English.
 const more=await searcher([track.name,track.artist].filter(Boolean).join(" "),{fetcher,signal}).catch(()=>[]);
 const previousCount=candidates.length;
 more.forEach(add);
 if(candidates.length>previousCount){
  const later=candidates.slice(previousCount);
  for(const candidate of later){
   if(signal?.aborted)throw new Error("搜尋已取消");
   if(candidate.instrumental)continue;
   try{
    const found=await getLyricsForTrack(candidate.id,{fetcher,signal});
    return {...found,usedAlternative:true};
   }catch(err){if(signal?.aborted)throw err;lastError=err;}
  }
 }
 throw new Error("找不到這首歌的韓文原文版本；LRCLIB 可能只有英文翻譯或羅馬拼音。請改選其他版本，或自行貼上韓文歌詞。");
}
export function externalLyricsLinks(query){
 const q=String(query||"").trim();
 return [
  {label:"Genius 歌詞搜尋",url:"https://genius.com/search?q="+encodeURIComponent(q)},
  {label:"Google 歌詞搜尋",url:"https://www.google.com/search?q="+encodeURIComponent(q+" 가사")},
  {label:"Apple Music 官方歌曲",url:"https://music.apple.com/tw/search?term="+encodeURIComponent(q)}
 ];
}
