import test from 'node:test';
import assert from 'node:assert/strict';
import {alignProvidedTranslations,translateLines,outputLinesWithTranslation} from '../src/line-translation.js';
test('provided translation takes priority and keeps original blank lines',async()=>{
 const ko=['안녕','','고마워'];
 const arr=alignProvidedTranslations(ko,'你好\n\n謝謝');
 assert.deepEqual(arr.map(x=>x?.text||''),['你好','','謝謝']);
 const fetcher=async()=>{throw Error('should not request MyMemory');};
 const result=await translateLines(ko,{provided:'你好\n\n謝謝',fetcher});
 assert.equal(result.translated,0);assert.deepEqual(outputLinesWithTranslation(ko,result.rows).map(x=>x.translation),['你好','','謝謝']);
});
test('missing line falls back to MyMemory; repeat lines are deduplicated',async()=>{
 const ko=['안녕','','안녕'];
 let requests=0;
 const fetcher=async()=>{requests++;return {ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'你好'}})};};
 const result=await translateLines(ko,{fetcher});
 assert.equal(result.translated,1);assert.equal(requests,1);
 assert.equal(result.rows[0].text,'你好');assert.equal(result.rows[2].text,'你好');
 assert.equal(result.rows[1],null);
});
