import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrack,decodeSyncedLyrics,searchTracks,searchArtistTracks,groupArtistTracks,getLyricsForTrack,externalLyricsLinks} from '../src/song-search.js';
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
