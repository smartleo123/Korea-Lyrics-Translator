import test from "node:test";
import assert from "node:assert/strict";
import {splitLyrics,reconstructLyrics} from "../src/layout.js";
import {annotateLine} from "../src/engine.js";
test("keeps line count, blank stanzas, spaces and trailing newline",()=>{
 const input="  첫 줄  \r\n\r\n둘째 줄\t  \r\n\r\n";
 const actual=splitLyrics(input);
 assert.deepEqual(actual,["  첫 줄  ","","둘째 줄\t  ","",""]);
 assert.equal(reconstructLyrics(actual),"  첫 줄  \n\n둘째 줄\t  \n\n");
});
test("keeps original breaks after word-level annotation",()=>{
 const source="감각도 마비\n\n사랑해\n별 같아";
 const dict=new Map([["감각",["感覺"]],["마비",["麻痺"]]]);
 const lines=splitLyrics(source).map(line=>annotateLine(line,[],dict,{사랑해:{type:"native",gloss:"愛你"}}));
 assert.equal(lines.length,4);
 assert.equal(lines[1].length,0);
 assert.equal(lines.map(line=>line.map(part=>part.text).join("")).join("\n"),source);
});
