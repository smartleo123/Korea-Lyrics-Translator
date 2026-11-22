import test from "node:test";
import assert from "node:assert/strict";
import {translationCandidates,translationKey,extractTranslation,translateOne,translateMissing,applyTranslations} from "../src/translation.js";
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

test('retrieves Chinese meaning for ambiguous Hanja without inventing a spelling',()=>{
 const lines=[[{text:'사고',type:'ambiguous',gloss:'',choices:['事故','思考'],source:'dictionary'}]];
 assert.deepEqual(translationCandidates(lines,{}).words,['사고']);
 applyTranslations(lines,{사고:'思考／事故'});
 assert.equal(lines[0][0].type,'ambiguous');
 assert.deepEqual(lines[0][0].choices,['事故','思考']);
 assert.equal(lines[0][0].gloss,'思考／事故');
});
test('prioritizes repeated untranslated words while respecting the request cap',()=>{
 const lines=[[{text:'희귀단어',type:'native',gloss:''}],
 [{text:'꾸준한',type:'native',gloss:''},{text:'꾸준한',type:'native',gloss:''},{text:'보석함',type:'native',gloss:''}]];
 const options=translationCandidates(lines,{},2);
 assert.equal(options.total,3);
 assert.equal(options.words[0],'꾸준한');
 assert.equal(options.words.length,2);
});

test('full sentence response is not truncated to the word-gloss limit',async()=>{
 const long='我的心在夜晚想起你，所以'+ '仍然很想念'.repeat(23);
 const fetcher=async()=>({ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:long}})});
 assert.equal((await translateOne('내 마음을 기억해',{fetcher,maxChars:500})).length,long.length);
 assert.equal((await translateOne('기억해',{fetcher})).length,100);
});

test('word-only translations cannot leak between different lyric sentences',async()=>{
 const sentenceA='여기는 내가 바라는 곳';
 const sentenceB='그 사람이 무언가를 바라';
 const one=[[{text:'바라',type:'native',gloss:''}]];
 const two=[[{text:'바라',type:'native',gloss:''}]];
 const cache={};
 let calls=0;
 const fetcher=async()=>{
  calls++;
  return {ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'希望'}})};
 };
 await translateMissing(one,{contexts:[sentenceA],cache,fetcher});
 assert.equal(cache[translationKey('바라',sentenceA)],'希望');
 assert.equal(cache[translationKey('바라',sentenceB)],undefined);
 assert.equal(translationCandidates(two,cache,10,{contexts:[sentenceB]}).total,1);
 applyTranslations(two,cache,{contexts:[sentenceB]});
 assert.equal(two[0][0].gloss,'');
 applyTranslations(one,cache,{contexts:[sentenceA]});
 assert.equal(one[0][0].gloss,'希望');
 assert.equal(calls,1);
});

test('decodes MyMemory HTML entities in translated Chinese',()=>{
 assert.equal(extractTranslation({responseStatus:200,responseData:{translatedText:'我&#24859;你 &amp; 他'}},'사랑해'),'我愛你 & 他');
 assert.equal(extractTranslation({responseStatus:200,responseData:{translatedText:'&#x4F60;&#x597D;'}},'안녕'),'你好');
});
