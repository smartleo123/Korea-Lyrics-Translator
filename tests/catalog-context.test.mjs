import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMON_GLOSSARY,inferHanjaInContext} from '../src/glossary.js';
test('native meanings are available while etymology remains separately determined',()=>{
 assert.equal(COMMON_GLOSSARY['눈물'],'眼淚');
 assert.equal(COMMON_GLOSSARY['기다리다'],'等待');
});
test('context hints only resolve an attested, uniquely supported Hanja option',()=>{
 const options=['事故','思考'];
 assert.equal(inferHanjaInContext('사고',options,'교통 사고 발생').gloss,'事故');
 assert.equal(inferHanjaInContext('사고',options,'깊은 사고와 철학').gloss,'思考');
 assert.equal(inferHanjaInContext('사고',options,'나는 사고 싶어'),null);
 assert.equal(inferHanjaInContext('사고',['思考'],'교통 사고'),null);
 assert.equal(inferHanjaInContext('사고',options,'교통 사고와 생각'),null);
});
