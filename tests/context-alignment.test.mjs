import test from 'node:test';
import assert from 'node:assert/strict';
import {applySentenceContext,sentenceContextGlosses} from '../src/context-alignment.js';
const part=(text,type='native',gloss='',source='pos')=>({text,type,gloss,source});
test('Chinese sentence cues correct mismatched gloss without inventing Hanja',()=>{
 const parts=[part('맘이','native','媽媽'),part('아파와','native','與阿帕')];
 const out=sentenceContextGlosses(parts,'我的心好痛');
 assert.equal(out[0].gloss,'心（主格）');
 assert.equal(out[1].gloss,'感到心痛');
 assert.equal(out[0].type,'native');
 assert.equal(out[0].translationSource,'sentence-context');
 assert.equal(parts[0].gloss,'媽媽'); // pure correction
});
test('no sentence translation leaves original output unchanged',()=>{
 const items=[part('눈이','ambiguous','')];
 assert.deepEqual(sentenceContextGlosses(items,''),items);
 assert.deepEqual(sentenceContextGlosses(items,'今天真的很美'),items);
});
test('custom corrections and attested Hanja are never overwritten by the Chinese sentence',()=>{
 const custom=part('말은','native','我自己寫的','custom');
 const hanja=part('말은','hanja','馬','dictionary');
 const [first,second]=sentenceContextGlosses([custom,hanja],'你剛剛說的話');
 assert.equal(first.gloss,'我自己寫的');
 assert.equal(second.gloss,'馬');
 const [third]=sentenceContextGlosses([part('말은','ambiguous','')],'你剛剛說的話');
 assert.equal(third.type,'native');
 assert.equal(third.gloss,'話語（主題）');
});
test('context never uses homograph cues when opposing sense also appears',()=>{
 const [eye]=sentenceContextGlosses([part('눈이','ambiguous','')],'眼裡有雪');
 assert.equal(eye.type,'ambiguous');
 const [eye2]=sentenceContextGlosses([part('눈이','ambiguous','')],'看見你的眼睛');
 assert.equal(eye2.gloss,'眼睛（主格）');
});
test('aligned lines only refine their corresponding Korean line',()=>{
 const lines=[[part('말은','ambiguous','')],[part('맘이','native','媽媽')]];
 const out=applySentenceContext(lines,[{text:'你剛剛說的話'},{text:'我的心很痛'}]);
 assert.equal(out[0][0].gloss,'話語（主題）');
 assert.equal(out[1][0].gloss,'心（主格）');
});
