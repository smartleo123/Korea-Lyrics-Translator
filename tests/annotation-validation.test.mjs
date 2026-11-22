import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWordAnnotations,validateAnnotationLines} from '../src/annotation-validation.js';
const token=(text,gloss,type='native',extra={})=>({text,gloss,type,...extra});
test('filters unrelated transliteration and word-only machine guesses without hardcoded Korean mappings',()=>{
 const parts=[
  token('머니까','摳門鬼','native',{translationSource:'MyMemory'}),
  token('가고','去','native',{translationSource:'MyMemory'}),
  token('혼자','獨自','native',{translationSource:'MyMemory'})
 ];
 const checked=validateWordAnnotations(parts,'我現在就想走，但有點遠。我一個人哭。');
 assert.equal(checked[0].gloss,'');
 assert.equal(checked[1].gloss,'');
 assert.equal(checked[2].gloss,'');
 assert.equal(parts[0].gloss,'摳門鬼');
});
test('keeps word-only machine meanings when Chinese sentence provides independent evidence',()=>{
 const parts=[token('가고','想走','native',{translationSource:'MyMemory'})];
 assert.equal(validateWordAnnotations(parts,'我現在就想走')[0].gloss,'想走');
});
test('ambiguous slash annotations select only supported option or remain unannotated',()=>{
 const parts=[token('언젠가','裡面／不是')];
 assert.equal(validateWordAnnotations(parts,'這不是你想的')[0].gloss,'不是');
 assert.equal(validateWordAnnotations(parts,'他走過來了')[0].gloss,'');
});
test('preserves user corrections and verified Hanja spellings even when Chinese differs',()=>{
 const parts=[
  token('단어','我的註解','native',{source:'custom'}),
  token('당장','當場','hanja',{source:'dictionary'}),
  token('반복','反覆','hanja',{source:'dictionary'})
 ];
 const actual=validateWordAnnotations(parts,'我現在想去');
 assert.equal(actual[0].gloss,'我的註解');
 assert.equal(actual[1].gloss,'當場');
 assert.equal(actual[2].gloss,'反覆');
});
test('line-by-line validation prevents borrowing context from neighboring lyrics',()=>{
 const lines=[
  [token('단어','摳門鬼','native',{translationSource:'MyMemory'})],
  [token('단어','心痛','native',{translationSource:'MyMemory'})]
 ];
 const checked=validateAnnotationLines(lines,[{text:'我很心痛'},{text:'沒有相關內容'}]);
 assert.equal(checked[0][0].gloss,'');
 assert.equal(checked[1][0].gloss,'');
});
test('grammar fragments do not become independently translated words',()=>{
 const parts=[token('은','銀','native',{source:'grammar'})];
 assert.equal(validateWordAnnotations(parts,'他說的話')[0].gloss,'');
});
