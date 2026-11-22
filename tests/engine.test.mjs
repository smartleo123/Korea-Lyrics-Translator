import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHeadword,segmentByOffsets,annotateSpan,annotateLine} from '../src/engine.js';
const hanja=new Map([['용서',['容恕']],['사고',['事故','思考']],['사랑',['思想']],['감각',['感覺']],['마비',['麻痺']]]);
const curated={사랑:{type:'native',gloss:'愛'},왜:{type:'native',gloss:'為什麼'}};
test('known Hanja, ambiguous Hanja and native overrides',()=>{
 assert.equal(classifyHeadword('용서','NNG',hanja).type,'hanja');
 assert.equal(classifyHeadword('사고','NNG',hanja).type,'ambiguous');
 assert.equal(classifyHeadword('사랑','NNG',hanja,curated).type,'native');
});
test('normal lexical nouns, verbs and particles are not wrongly marked unknown',()=>{
 for(const [word,pos] of [['처음','NNG'],['만나다','VV'],['슬픈','VA'],['너','NP'],['는','JX'],['아','EC'],['아픔','NNG']]){
  const a=classifyHeadword(word,pos,hanja,curated);
  assert.equal(a.type,'native',word+' / '+pos);
 }
});
test('grammar POS overrides accidental Hanja homophones',()=>{
 assert.equal(classifyHeadword('수','NNB',new Map([['수',['數']]])).type,'native');
 assert.equal(classifyHeadword('가','JKS',new Map([['가',['家']]])).type,'native');
});
test('correctly color suffix on Hanja nouns',()=>{
 const result=annotateSpan({surface:'감각도',morphs:[{text:'감각',pos:'NNG'}]},hanja,curated);
 assert.deepEqual(result.map(x=>x.type),['hanja','native']);
 assert.equal(result.map(x=>x.text).join(''),'감각도');
});
test('does not invent Hanja for ordinary Hangul unknown noun',()=>{
 const result=annotateSpan({surface:'초라해진',morphs:[{text:'초라',pos:'VA'}]},hanja,curated);
 assert.equal(result[0].type,'native');
});
test('preserves exact original lyrics without replacing inferred lemmas',()=>{
 const s='용서 못 해! 🥰';
 const spans=segmentByOffsets(s,[{start:0,end:2,text:'용서',pos:'NNG'},{start:3,end:4,text:'못',pos:'MAG'},{start:5,end:6,text:'하',pos:'VV'}]);
 assert.equal(spans.map(x=>x.surface).join(''),s);
 assert.equal(annotateLine(s,[{start:0,end:2,text:'용서',pos:'NNG'}],hanja,curated).map(x=>x.text).join(''),s);
});
test('unknown unrelated text retains clear separation from confirmed Hanja',()=>{
 const parts=annotateLine('용서 가자', [{start:0,end:2,text:'용서',pos:'NNG'},{start:3,end:5,text:'가',pos:'VV'}],hanja,curated);
 assert.equal(parts.map(x=>x.text).join(''),'용서 가자');
 assert.equal(parts[0].type,'hanja');
});

test('inflected verbs never inherit accidental Hanja homographs',()=>{
 const dict=new Map([['지샌',['智善']],['밤',['夜']],['감각',['感覺']]]);
 assert.equal(classifyHeadword('지샌','VV',dict).type,'native');
 assert.equal(classifyHeadword('지샌',undefined,dict).type,'unknown');
 assert.equal(classifyHeadword('감각','NNG',dict).type,'hanja');
 const parts=annotateSpan({surface:'지샌',morphs:[{text:'지새',pos:'VV'},{text:'ㄴ',pos:'ETM'}]},dict);
 assert.equal(parts.some(p=>p.type==='hanja'),false);
});
