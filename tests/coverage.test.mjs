import test from 'node:test';
import assert from 'node:assert/strict';
import {completeUnannotatedKorean,countKoreanCoverage} from '../src/coverage.js';
import {LYRIC_SURFACE_GLOSSARY} from '../src/glossary.js';
test('reconstructs a word before MyMemory instead of translating morphology fragments',()=>{
 const original=[
  {text:'꾸준',type:'native',gloss:'',source:'pos'},
  {text:'한',type:'native',gloss:'',source:'grammar'},
  {text:' ',type:'plain',gloss:''},
  {text:'네',type:'native',gloss:'',source:'pos'}
 ];
 const result=completeUnannotatedKorean(original,LYRIC_SURFACE_GLOSSARY);
 assert.equal(result.map(x=>x.text).join(''),'꾸준한 네');
 assert.equal(result[0].text,'꾸준한');
 assert.equal(result[0].gloss,'持續不懈的');
 assert.equal(result[2].text,'네');
});
test('does not replace already known Sino-Korean roots with guessed whole-word meanings',()=>{
 const parts=[
  {text:'보석',type:'hanja',gloss:'寶石'},
  {text:'함',type:'native',gloss:'',source:'grammar'}
 ];
 const result=completeUnannotatedKorean(parts,LYRIC_SURFACE_GLOSSARY);
 assert.equal(result.length,2);
 assert.equal(result.map(x=>x.text).join(''),'보석함');
 assert.equal(result[0].gloss,'寶石');
});
test('screenshot sample receives meaning for formerly blank Korean surfaces',()=>{
 const examples=['꾸준한','보석함','비싼','솔직함','동네','헤매','나인데','가두지'];
 for(const example of examples){
  const result=completeUnannotatedKorean([{text:example,type:'native',gloss:''}],LYRIC_SURFACE_GLOSSARY);
  assert.ok(result[0].gloss,'missing Chinese gloss: '+example);
 }
 const rows=[[{text:'꾸준한',type:'native',gloss:'持續不懈的'},{text:' ',type:'plain'}, {text:'가',type:'native',source:'grammar',gloss:''}]];
 assert.deepEqual(countKoreanCoverage(rows),{words:1,glossed:1,missing:0});
});

