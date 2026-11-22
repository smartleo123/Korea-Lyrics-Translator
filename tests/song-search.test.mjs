import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrack,decodeSyncedLyrics,searchTracks,searchTrackByMetadata,searchTrackWithArtistAliases,normalizeSearchTitle,artistNameVariants,artistMatches,searchArtistTracks,groupArtistTracks,getLyricsForTrack,getKoreanLyricsWithFallback,inspectLyricLanguage,chooseKoreanLyrics,externalLyricsLinks} from '../src/song-search.js';
test('song search keeps metadata and limits results',async()=>{
 const fetcher=async(url)=>({ok:true,json:async()=>[{id:17,trackName:'예시',artistName:'가수',albumName:'앨범',duration:120}]});
 const items=await searchTracks('예시',{fetcher});
 assert.equal(items.length,1);assert.equal(items[0].artist,'가수');assert.equal(items[0].id,17);
});
test('selected lyrics preserve original stanza and Korean text',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>({id:17,trackName:'예시',artistName:'가수',plainLyrics:'첫 줄\n\n두 번째 줄\n'})});
 const result=await getLyricsForTrack(17,{fetcher});
 assert.equal(result.lyrics,'첫 줄\n\n두 번째 줄');
 assert.equal(decodeSyncedLyrics('[00:01.00]첫 줄\n[00:02.00]두 번째 줄'),'첫 줄\n두 번째 줄');
});
test('external official source uses encoded query',()=>{
 assert.match(externalLyricsLinks('용서 못해')[2].url,/music.apple.com/);
});

test('search by artist name only and ignore unrelated title matches',async()=>{
 let requested;
 const fetcher=async(url)=>{
  requested=url;
  return {ok:true,json:async()=>[
   {id:10,trackName:'좋은 날',artistName:'IU',albumName:'Real',duration:230},
   {id:11,trackName:'좋은 날',artistName:'IU',albumName:'Live',duration:235},
   {id:12,trackName:'IU Song',artistName:'Different Artist',albumName:'Various',duration:200},
   {id:13,trackName:'밤편지',artistName:'아이유 (IU)',albumName:'Palette',duration:260}
  ]};
 };
 const tracks=await searchArtistTracks('IU',{fetcher});
 assert.match(requested,/\/search\?q=IU$/);
 assert.deepEqual(tracks.map(t=>t.id),[10,11,13]);
 const grouped=groupArtistTracks(tracks);
 assert.equal(grouped.length,2);
 assert.equal(grouped.find(t=>t.name==='좋은 날').versions.length,2);
});
test('artist search requires name and returns no unrelated items',async()=>{
 assert.deepEqual(await searchArtistTracks(''),[]);
 const results=await searchArtistTracks('BTS',{fetcher:async()=>({ok:true,json:async()=>[
  {id:20,trackName:'BTS',artistName:'Other',albumName:'none'}
 ]})});
 assert.equal(results.length,0);
});

test('reject all-English and romanized Korean lyrics but accept bilingual Korean/English',()=>{
 assert.equal(inspectLyricLanguage("I love you forever\\nYou are the only one").isKorean,false);
 assert.equal(inspectLyricLanguage("Saranghae neol wonhae\\nNae mameul arajwo").isKorean,false);
 assert.equal(inspectLyricLanguage("사랑해 너를\\nI love you forever").isKorean,true);
 assert.equal(chooseKoreanLyrics({plainLyrics:"I love you forever",syncedLyrics:"[00:01.00]사랑해 너를\\n[00:02.00]많이 보고 싶어"}).kind,"synced");
});
test('reject an English translation from the same song instead of importing it',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>({id:41,trackName:"테스트",artistName:"가수",plainLyrics:"Forever you are my love\\nI will never forget you"})});
 await assert.rejects(getLyricsForTrack(41,{fetcher}),/영문|英文|羅馬拼音/);
});
test('retries a Korean alternate for the same title and artist only',async()=>{
 const english={id:11,name:"사랑",artist:"가수",album:"English"},
       korean={id:12,name:"사랑",artist:"가수",album:"Original"},
       unrelated={id:13,name:"사랑",artist:"別人",album:"Other"};
 const fetcher=async url=>({ok:true,json:async()=>url.endsWith("/11")?
  {id:11,trackName:"사랑",artistName:"가수",plainLyrics:"I want to be with you\\nYou are my sunshine"}:
  url.endsWith("/12")?{id:12,trackName:"사랑",artistName:"가수",plainLyrics:"사랑해 너를\\n많이 보고 싶어"}:
  {id:13,trackName:"사랑",artistName:"別人",plainLyrics:"여기는 한국어\\n사랑을 해요"}
 });
 const result=await getKoreanLyricsWithFallback(english,[english,unrelated,korean],{fetcher,searcher:async()=>[]});
 assert.equal(result.track.id,12);assert.equal(result.usedAlternative,true);
 assert.match(result.lyrics,/사랑해/);
});

test('ignores records with invalid song IDs',async()=>{
 const response=await searchTracks('korea',{fetcher:async()=>({ok:true,json:async()=>[
  {id:null,trackName:'Bad',artistName:'A'},
  {id:0,trackName:'Bad zero',artistName:'B'},
  {id:42,trackName:'Good',artistName:'C'}
 ]})});
 assert.deepEqual(response.map(x=>x.id),[42]);
 await assert.rejects(getLyricsForTrack(null),/無效/);
});
test('incidental Korean text in a mostly English song is not an original Korean lyric',()=>{
 const input=['한국어 제목',...Array.from({length:15},(_,i)=>'I love you and miss you everyday number '+i)].join('\n');
 assert.equal(inspectLyricLanguage(input).isKorean,false);
});

test('metadata lookup searches title and artist in dedicated LRCLIB fields',async()=>{
 let requested='';
 const fetcher=async(url)=>{requested=url;return {ok:true,json:async()=>[
  {id:420,trackName:"It's Me",artistName:'ILLIT',albumName:'Album'}
 ]};};
 const songs=await searchTrackByMetadata('It′s Me','ILLIT',{fetcher});
 const params=new URL(requested).searchParams;
 assert.equal(params.get('track_name'),"It's Me");
 assert.equal(params.get('artist_name'),'ILLIT');
 assert.equal(params.has('q'),false);
 assert.equal(songs.length,1);
 assert.equal(normalizeSearchTitle('It’s Me'),"It's Me");
});
test('429 response exposes rate-limit instruction and does not retry song versions',async()=>{
 const fetcher=async()=>({ok:false,status:429,headers:{get:name=>name==='Retry-After'?'10':null}});
 await assert.rejects(searchTracks('ILLIT',{fetcher}),/10 秒後.*429/);
 let calls=0;
 const track={id:55,name:"It's Me",artist:'ILLIT'};
 await assert.rejects(getKoreanLyricsWithFallback(track,[track],{
  fetcher:async()=>{calls++;return {ok:false,status:429,headers:{get:()=>null}};},
  searcher:async()=>{throw Error('Search must not happen after 429');}
 }),/429/);
 assert.equal(calls,1);
});
test('search without valid title returns empty results and does not call provider',async()=>{
 let called=0;
 const result=await searchTrackByMetadata(' ','ILLIT',{fetcher:async()=>{called++;}});
 assert.deepEqual(result,[]);
 assert.equal(called,0);
});

test('BESTie English stage name falls back to verified Hangul alias 베스티',async()=>{
 const params=[];
 const fetcher=async(url)=>{
  const q=new URL(url).searchParams.get('q');params.push(q);
  return {ok:true,json:async()=>q==='베스티'?
   [{id:901,trackName:'연애의 조건',artistName:'베스티(BESTie)',albumName:'Hot Baby'}]:
   [{id:99,trackName:'Bestie',artistName:'Another Singer'}]};
 };
 const hits=await searchArtistTracks('bestie',{fetcher});
 assert.deepEqual(params,['bestie','베스티']);
 assert.equal(hits.length,1);assert.equal(hits[0].id,901);
 assert.equal(artistMatches('베스티 (BESTie)','BESTie'),true);
 assert.deepEqual(artistNameVariants('BESTie'),['BESTie','베스티']);
});
test('when an artist is not represented in the lyric catalog do not claim they do not exist',async()=>{
 const urls=[];
 const fetcher=async(url)=>{urls.push(url);return {ok:true,json:async()=>[]};};
 const songs=await searchArtistTracks('BESTie',{fetcher});
 assert.deepEqual(songs,[]);assert.equal(urls.length,2);
});
test('song title matching retries Hangul artist spelling before returning empty',async()=>{
 const params=[];
 const fetcher=async(url)=>{
  const p=new URL(url).searchParams;params.push(p.get('artist_name'));
  return {ok:true,json:async()=>p.get('artist_name')==='베스티'?
   [{id:903,trackName:'연애의 조건',artistName:'베스티'}]:[]};
 };
 const songs=await searchTrackWithArtistAliases('연애의 조건','BESTie',{fetcher});
 assert.equal(songs.length,1);
 assert.deepEqual(params,['BESTie','베스티']);
});
