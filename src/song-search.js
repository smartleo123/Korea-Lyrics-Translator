// LRCLIB browser API integration: search tracks first, then request selected lyrics.
// Lyrics are never committed to this repository or stored on the server.
const BASE="https://lrclib.net/api";
function safeStr(x){return typeof x==="string"?x:"";}
export function normalizeTrack(hit){
 if(!hit||!Number.isSafeInteger(Number(hit.id)))return null;
 return {id:Number(hit.id),name:safeStr(hit.trackName),artist:safeStr(hit.artistName),album:safeStr(hit.albumName),duration:Number(hit.duration)||0,instrumental:!!hit.instrumental};
}
export async function searchTracks(query,{fetcher=fetch,signal}={}){
 const q=String(query||"").trim();
 if(!q)return [];
 const res=await fetcher(BASE+"/search?"+new URLSearchParams({q}),{signal,headers:{Accept:"application/json"}});
 if(!res.ok)throw new Error("LRCLIB 搜尋失敗 (HTTP "+res.status+")");
 const json=await res.json();
 if(!Array.isArray(json))throw new Error("搜尋回傳格式異常");
 return json.map(normalizeTrack).filter(Boolean).filter(t=>t.name||t.artist).slice(0,20);
}

/**
 * Artist-only discovery. LRCLIB's public API requires `q` or a track name;
 * `artist_name` by itself is not a supported search. Query the artist via
 * `q`, then reject unrelated results that matched a title or album instead.
 * The public endpoint returns at most 20 results and cannot be paginated.
 */
export async function searchArtistTracks(artist,{fetcher=fetch,signal}={}){
 const name=String(artist||"").trim();
 if(!name)return [];
 const response=await searchTracks(name,{fetcher,signal});
 const normalized=normalizeArtist(name);
 return response.filter(track=>normalizeArtist(track.artist).includes(normalized))
   .sort((a,b)=>{
     const ae=normalizeArtist(a.artist)===normalized,be=normalizeArtist(b.artist)===normalized;
     if(ae!==be)return ae?-1:1;
     return a.name.localeCompare(b.name);
   });
}
function normalizeArtist(str){
 return String(str||"").normalize("NFKC").toLocaleLowerCase().replace(/[\s\u00b7\u2022._\-()\[\]]+/g,"").trim();
}
/**
 * Group different recordings/releases of the same track for a concise song
 * list, while preserving every LRCLIB record so users can choose the version.
 */
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
 if(!Number.isSafeInteger(Number(id))||Number(id)<1)throw new Error("無效的曲目 ID");
 const r=await fetcher(BASE+"/get/"+Number(id),{signal,headers:{Accept:"application/json"}});
 if(!r.ok)throw new Error("LRCLIB 找不到這首歌的歌詞");
 const x=await r.json();
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
