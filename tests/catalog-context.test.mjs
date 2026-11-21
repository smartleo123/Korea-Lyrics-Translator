import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMON_GLOSSARY,inferHanjaInContext} from '../src/glossary.js';
import {searchCatalog,normalizeCatalogTrack} from '../src/music-catalog.js';
test('native meanings are available while etymology remains separately determined',()=>{
 assert.equal(COMMON_GLOSSARY['눈물'],'眼淚');
 assert.equal(COMMON_GLOSSARY['기다리다'],'等待');
});
test('context hints only resolve an attested, uniquely supported Hanja option',()=>{
 const options=['事故','思考'];
 assert.equal(inferHanjaInContext('사고',options,'교통 사고 발생').gloss,'事故');
 assert.equal(inferHanjaInContext('사고',options,'깊은 사고와 철학').gloss,'思考');
 assert.equal(inferHanjaInContext('사고',options,'나는 사고 싶어'),null);
 assert.equal(inferHanjaInContext('사고',['思考'],'교통 사고'),null);
 assert.equal(inferHanjaInContext('사고',options,'교통 사고와 생각'),null);
});
test('iTunes catalog provides metadata only, never lyrics',async()=>{
 const fetcher=async(url)=>({ok:true,json:async()=>({results:[
  {kind:'song',trackId:12,trackName:'밤편지',artistName:'IU',collectionName:'Palette',trackTimeMillis:240000},
  {kind:'song',trackId:13,trackName:'밤편지',artistName:'IU',collectionName:'Single'},
  {kind:'song',trackId:14,trackName:'밤편지',artistName:'Other'},
  {kind:'feature-movie',trackId:15,trackName:'Film',artistName:'IU'}
 ]})});
 const items=await searchCatalog('IU',{artistMode:true,fetcher});
 assert.equal(items.length,1);assert.equal(items[0].name,'밤편지');
 assert.equal(items[0].catalogOnly,true);
 assert.equal(Object.hasOwn(items[0],'lyrics'),false);
 assert.equal(normalizeCatalogTrack({kind:'song',trackName:'T',artistName:'A',trackId:null}),null);
});
