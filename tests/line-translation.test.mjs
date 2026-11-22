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

test('browser translator takes precedence over old MyMemory cache, with isolated provider cache',async()=>{
 const cache={"안녕":"舊版錯誤翻譯","MyMemory\u241E안녕":"你好","Browser\u241E안녕":"您好"};
 const translator={translate:async()=>{throw Error("Browser cache should win");}};
 const result=await translateLines(["안녕"],{cache,browserTranslator:translator,fetcher:async()=>{throw Error("should not fetch")}});
 assert.equal(result.rows[0].text,"您好");
 assert.equal(result.rows[0].source,"Browser");
});
test('browser model output is preferred, and identical refrain is translated once',async()=>{
 let browserCalls=0,networkCalls=0;
 const translator={translate:async()=>{browserCalls++;return "我喜歡自由";}};
 const fetcher=async()=>{networkCalls++;throw Error("not expected");};
 const result=await translateLines(["자유를 좋아해","자유를 좋아해"],{browserTranslator:translator,fetcher});
 assert.equal(result.rows[1].source,"Browser");
 assert.equal(browserCalls,1);
 assert.equal(networkCalls,0);
});
test('unsupported, failed or untranslated browser output gracefully falls back to MyMemory',async()=>{
 const translator={translate:async()=> "안녕"};
 const fetcher=async()=>({ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:"你好"}})});
 const result=await translateLines(["안녕"],{browserTranslator:translator,fetcher});
 assert.equal(result.rows[0].text,"你好");
 assert.equal(result.rows[0].source,"MyMemory");
});
test('provided line remains highest priority even if browser is enabled',async()=>{
 const translator={translate:async()=>{throw Error("should not run")}};
 const out=await translateLines(["안녕"],{provided:"人工你好",browserTranslator:translator});
 assert.equal(out.rows[0].source,"provided");
});
