import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrack,decodeSyncedLyrics,searchTracks,getLyricsForTrack,externalLyricsLinks} from '../src/song-search.js';
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
