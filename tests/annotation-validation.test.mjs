import test from 'node:test';
import assert from 'node:assert/strict';
import {lexicalContextEvidence,validateWordAnnotations,validateAnnotationLines} from '../src/annotation-validation.js';
const token=(text,gloss,type='native',extra={})=>({text,gloss,type,...extra});
test('different expressions in sentence translation never erase lexical glosses',()=>{
 const parts=[
  token('머니까','很遠','native',{translationSource:'MyMemory'}),
  token('가고','去','native',{translationSource:'MyMemory'}),
  token('혼자','獨自','native',{translationSource:'MyMemory'})
 ];
 const out=validateWordAnnotations(parts,'我現在就想走，但有點遠。我一個人哭。');
 assert.equal(out.length,3);
 assert.deepEqual(out.map(x=>x.gloss),parts.map(x=>x.gloss));
 assert.equal(out[0].contextEvidence,'not-literal');
 assert.equal(out[1].contextEvidence,'not-literal');
});
test('lexical context evidence is supporting metadata, not bilingual alignment',()=>{
 assert.equal(lexicalContextEvidence('想走','我現在就想走'),'literal');
 assert.equal(lexicalContextEvidence('去','我現在就想走'),'not-literal');
 assert.equal(lexicalContextEvidence('','我現在就想走'),'unavailable');
});
test('dictionary Hanja, custom edits and lexicon meanings are preserved',()=>{
 const parts=[
  token('단어','我的註解','native',{source:'custom',translationSource:'MyMemory'}),
  token('당장','當場','hanja',{source:'dictionary'}),
  token('마음','內心','native',{translationSource:'lexicon'})
 ];
 const out=validateWordAnnotations(parts,'現在就想走');
 assert.deepEqual(out,parts);
});
test('sentence evidence is computed only from corresponding translated line',()=>{
 const source=[[token('가고','走','native',{translationSource:'MyMemory'})],
               [token('오고','來','native',{translationSource:'MyMemory'})]];
 const out=validateAnnotationLines(source,[{text:'我們走了'},{text:'你來了'}]);
 assert.equal(out[0][0].contextEvidence,'literal');
 assert.equal(out[1][0].contextEvidence,'literal');
});
test('grammar fragments never receive context evidence',()=>{
 const part=token('은','銀','native',{source:'grammar'});
 assert.deepEqual(validateWordAnnotations([part],'說話'),[part]);
});
