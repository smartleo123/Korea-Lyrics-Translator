import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLyricSurface} from '../src/context-gloss.js';

const tok=(text,type='native',gloss='',source='pos')=>({text,type,gloss,source});
const plain=text=>({text,type:'plain',gloss:''});
test('fixes misleading Korean homophones and inflections without altering text',()=>{
 const input=[
  tok('내'),plain(' '),tok('맘','hanja','媽媽','dictionary'),tok('이','native','','grammar'),
  plain(' '),tok('아파','native','與阿帕','pos'),tok('와','native','','grammar'),
  plain(' '),tok('보일','hanja','煮沸','dictionary'),
  plain(' '),tok('때','native','','pos'),tok('마다','native','','grammar')
 ];
 const result=resolveLyricSurface(input);
 assert.equal(result.map(p=>p.text).join(''),'내 맘이 아파와 보일 때마다');
 assert.equal(result.find(p=>p.text==='맘이').gloss,'心（主格）');
 assert.equal(result.find(p=>p.text==='맘이').type,'native');
 assert.equal(result.find(p=>p.text==='아파와').gloss,'痛起來／感到心痛');
 assert.equal(result.find(p=>p.text==='보일').gloss,'看見／看起來的');
 assert.equal(result.find(p=>p.text==='때마다').gloss,'每當……時');
});
test('spoken words, not horse, in 한 말은',()=>{
 const result=resolveLyricSurface([tok('방금'),plain(' '),tok('한'),plain(' '),tok('말','hanja','馬','dictionary'),tok('은','native','','grammar')]);
 assert.equal(result.map(p=>p.text).join(''),'방금 한 말은');
 assert.equal(result.find(p=>p.text==='한').gloss,'說過的');
 assert.equal(result.find(p=>p.text==='말은').gloss,'話語（主題）');
});
test('real manual corrections override built-in contextual glosses',()=>{
 const result=resolveLyricSurface([tok('맘'),tok('이')],{custom:{맘이:{type:'native',gloss:'自訂解釋'}}});
 assert.equal(result.length,2);
 const first=resolveLyricSurface([tok('맘','native','自己定義','custom'),tok('이')]);
 assert.equal(first[0].gloss,'自己定義');
});
test('unknown homophones remain undecided instead of being force translated',()=>{
 const result=resolveLyricSurface([tok('말','ambiguous',''),plain(' '),tok('한','native','')]);
 assert.equal(result[0].type,'ambiguous');
 assert.equal(result[0].gloss,'');
});
