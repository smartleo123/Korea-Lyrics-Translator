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
export function decodeSyncedLyrics(raw){
 const lines=safeStr(raw).replace(/\r\n?/g,"\n").split("\n");
 return lines.map(line=>line.replace(/^\s*\[(?:\d{1,3}:)?\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*/,""))
  .filter(line=>!/^\[(?:ar|al|ti|by|offset|length):/i.test(line))
  .join("\n").trim();
}
export async function getLyricsForTrack(id,{fetcher=fetch,signal}={}){
 if(!Number.isSafeInteger(Number(id))||Number(id)<1)throw new Error("無效的曲目 ID");
 const r=await fetcher(BASE+"/get/"+Number(id),{signal,headers:{Accept:"application/json"}});
 if(!r.ok)throw new Error("LRCLIB 找不到這首歌的歌詞");
 const x=await r.json();
 const lyrics=safeStr(x.plainLyrics).trim()||decodeSyncedLyrics(x.syncedLyrics);
 if(x.instrumental||!lyrics)throw new Error("這個版本沒有可用的文字歌詞");
 return {lyrics,track:normalizeTrack(x),source:"LRCLIB"};
}
export function externalLyricsLinks(query){
 const q=String(query||"").trim();
 return [
  {label:"Genius 歌詞搜尋",url:"https://genius.com/search?q="+encodeURIComponent(q)},
  {label:"Google 歌詞搜尋",url:"https://www.google.com/search?q="+encodeURIComponent(q+" 가사")},
  {label:"Apple Music 官方歌曲",url:"https://music.apple.com/tw/search?term="+encodeURIComponent(q)}
 ];
}
