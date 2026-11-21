import test from 'node:test';
import assert from 'node:assert/strict';
import {searchMusicBrainzArtists,searchMusicBrainzSongs,getMusicBrainzRecordingPage,appendUniqueSongs,normalizeRecordingPage} from '../src/musicbrainz.js';
const artist={id:'6d4ff5b0-49ee-4c58-8f33-bf1f2ac71489',name:'IU',aliases:['아이유'],country:'KR'};
test('resolve artist identities with ids and aliases, not just name matches',async()=>{
 const urls=[];
 const fetcher=async url=>{
  urls.push(url);
  return {ok:true,json:async()=>({artists:[
   {id:artist.id,name:'IU',country:'KR',aliases:[{name:'아이유'}],score:100},
   {id:'broken',name:'Wrong'}
  ]})};
 };
 const found=await searchMusicBrainzArtists('아이유',{fetcher});
 assert.equal(found.length,1);
 assert.equal(found[0].name,'IU');
 assert.deepEqual(found[0].aliases,['아이유']);
 assert.match(urls[0],/artist\/\?/);
});
test('retrieve recording pages by canonical artist id and advance offset using raw count',async()=>{
 const urls=[];
 const fetcher=async url=>{
  urls.push(url);
  const offset=Number(new URL(url).searchParams.get('offset'));
  return {ok:true,json:async()=>({
   'recording-count':202,recordings:offset===0?
    [{id:'rec1',title:'밤편지'},{id:'rec2',title:'밤편지'}]:
    [{id:'rec3',title:'좋은 날'}]
  })};
 };
 const one=await getMusicBrainzRecordingPage(artist,{limit:100,fetcher});
 assert.equal(one.tracks.length,1);assert.equal(one.offset,2);assert.equal(one.total,202);
 assert.equal(one.hasMore,true);
 const two=await getMusicBrainzRecordingPage(artist,{offset:one.offset,limit:100,fetcher});
 assert.equal(two.offset,3);
 assert.equal(new URL(urls[1]).searchParams.get('offset'),'2');
 assert.deepEqual(appendUniqueSongs(one.tracks,two.tracks).map(t=>t.name),['밤편지','좋은 날']);
});
test('empty final page stops pagination without presenting complete official discography guarantee',()=>{
 const page=normalizeRecordingPage({'recording-count':95,recordings:[]},artist,100);
 assert.equal(page.hasMore,false);
});

test('title search uses MusicBrainz recordings and filters matching artist names',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>({recordings:[
  {id:'1',title:'밤편지','artist-credit':[{artist:{id:artist.id,name:'IU'}}]},
  {id:'2',title:'밤편지','artist-credit':[{artist:{id:artist.id,name:'IU'}}]},
  {id:'3',title:'밤편지','artist-credit':[{artist:{id:'other',name:'Other'}}]}
 ]})});
 const result=await searchMusicBrainzSongs('밤편지',{artistName:'IU',fetcher});
 assert.equal(result.length,1);
 assert.equal(result[0].name,'밤편지');
 assert.equal(result[0].artist,'IU');
});
