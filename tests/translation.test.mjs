import test from "node:test";
import assert from "node:assert/strict";
import {translationCandidates,extractTranslation,translateOne,translateMissing,applyTranslations} from "../src/translation.js";
test("translates unique Korean items without touching Hanja and grammar",()=>{
 const lines=[[{text:"사랑",type:"native",gloss:"愛"},{text:"떠나",type:"native",gloss:""},{text:"용서",type:"hanja",gloss:"容恕"},{text:"떠나",type:"native",gloss:""}]];
 assert.deepEqual(translationCandidates(lines,{}).words,["떠나"]);
 assert.equal(translationCandidates(lines,{떠나:"離開"}).total,0);
});
test("rejects empty and untranslated responses",()=>{
 assert.equal(extractTranslation({responseStatus:200,responseData:{translatedText:"사랑"}},"사랑"),"");
 assert.equal(extractTranslation({responseStatus:429,responseData:{translatedText:"愛"}},"사랑"),"");
 assert.equal(extractTranslation({responseStatus:200,responseData:{translatedText:"愛"}},"사랑"),"愛");
});
test("fetch translation uses official MyMemory endpoint and preserves clean gloss",async()=>{
 let url;const fetcher=async u=>{url=u;return {ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:"離開"}})};};
 const gloss=await translateOne("떠나",{fetcher});
 assert.equal(gloss,"離開");assert.match(url,/langpair=ko%7Czh-TW/);
 const lines=[[{text:"떠나",type:"native",gloss:""},{text:"용서",type:"hanja",gloss:"容恕"}]];
 applyTranslations(lines,{떠나:"離開",용서:"饒恕"});
 assert.equal(lines[0][0].gloss,"離開");
 assert.equal(lines[0][1].gloss,"容恕");
});

test('a bad free translation service stops requests after repeated failures',async()=>{
 let calls=0;
 const lines=[Array.from({length:9},(_,i)=>({text:'가나다'+ '라'.repeat(i),type:'native',gloss:''}))];
 const fetcher=async()=>{calls++;throw Error('HTTP 429')};
 const result=await translateMissing(lines,{fetcher,maxFailures:3,limit:9});
 assert.equal(calls,3);assert.equal(result.failed,3);
 assert.equal(result.stopped,true);assert.equal(result.skipped,6);
});
test('already aborted translation never calls the provider',async()=>{
 const controller=new AbortController();controller.abort();
 let called=0;
 const result=await translateMissing([[{text:'사랑해요',type:'native',gloss:''}]],{signal:controller.signal,fetcher:async()=>{called++}});
 assert.equal(called,0);assert.equal(result.attempted,0);
});
