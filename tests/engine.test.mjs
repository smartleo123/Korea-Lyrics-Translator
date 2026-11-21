import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHeadword,segmentByOffsets} from '../src/engine.js';
test('recognizes unambiguous and ambiguous hanja',()=>{
const d=new Map([['용서',['容恕']],['사고',['事故','思考']],['사랑',['思想']]]);
assert.equal(classifyHeadword('용서','NNG',d).type,'hanja');
assert.equal(classifyHeadword('사고','NNG',d).type,'ambiguous');
assert.equal(classifyHeadword('사랑','NNG',d,{사랑:{type:'native',gloss:'愛'}}).type,'native');
});
test('never removes Hangul characters',()=>{
const s='용서 못 해';
const spans=segmentByOffsets(s,[{start:0,end:2,text:'용서',pos:'NNG'},{start:3,end:4,text:'못',pos:'MAG'},{start:5,end:6,text:'하',pos:'VV'}]);
assert.equal(spans.map(s=>s.surface).join(''),s);
});
