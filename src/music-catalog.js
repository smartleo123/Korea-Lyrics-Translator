// Independent song catalog for discovery only. Apple iTunes Search returns
// track metadata, NOT licensed lyrics. A selected track still needs to be
// matched against LRCLIB before lyrics can be imported.
const ENDPOINT="https://itunes.apple.com/search";
export function normalizeCatalogTrack(record){
 if(!record||record.kind!=="song"||!record.trackName||!record.artistName)return null;
 const id=Number(record.trackId);
 if(!Number.isSafeInteger(id)||id<=0)return null;
 return {id,name:record.trackName,artist:record.artistName,
  album:record.collectionName||"",duration:Math.round((Number(record.trackTimeMillis)||0)/1000),
  catalogOnly:true,source:"iTunes",trackUrl:/^https:\/\/music\.apple\.com\//.test(record.trackViewUrl||"")?record.trackViewUrl:""};
}
function simplified(x){return String(x||"").normalize("NFKC").toLowerCase().replace(/[\s._()\-\[\]]+/g,"");}
export async function searchCatalog(query,{artistMode=false,fetcher=fetch,signal}={}){
 const term=String(query||"").trim();if(!term)return [];
 const url=ENDPOINT+"?"+new URLSearchParams({term,entity:"song",limit:"50",country:"tw"}).toString();
 const response=await fetcher(url,{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("歌曲目錄搜尋暫時無法使用");
 const data=await response.json();
 if(!Array.isArray(data.results))return [];
 const artist=simplified(term);
 const tracks=data.results.map(normalizeCatalogTrack).filter(Boolean);
 const filtered=artistMode?tracks.filter(track=>simplified(track.artist).includes(artist)):tracks;
 const seen=new Set();
 return filtered.filter(track=>{const key=simplified(track.name)+"|"+simplified(track.artist);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,35);
}
