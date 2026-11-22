import test from "node:test";
import assert from "node:assert/strict";
import {splitKorean,splitChinese,similarity,alignVectors,alignInBrowser} from "../src/local-alignment.js";
test("tokenization is not song-specific",()=>{
 assert.deepEqual(splitKorean("나는 너를 만나고!"),["나는","너를","만나고"]);
 assert.deepEqual(splitChinese(""),[]);
 assert.ok(splitChinese("我今天去學校").length>0);
});
test("vector similarity is normalized",()=>{
 assert.equal(similarity([1,0],[1,0]),1);
 assert.equal(similarity([1,0],[0,1]),0);
 assert.equal(similarity([0,0],[1,0]),-1);
});
test("mutual neighbor links abstain on invalid or uninformative vectors",()=>{
 const links=alignVectors(["a","b"],["x","y"],[[1,0],[0,1]],[[1,0],[0,1]],{threshold:.5,margin:0});
 assert.deepEqual(links.map(x=>[x.source,x.target]),[[0,0],[1,1]]);
 assert.deepEqual(alignVectors(["a"],["x"],[[0,0]],[[1,0]]),[]);
 assert.throws(()=>alignVectors(["a"],["x"],[],[[1,0]]),/向量/);
});
test("mock embeddings check adapter shape, not real AI accuracy",async()=>{
 const model=async inputs=>({dims:[inputs.length,2],data:new Float32Array(inputs.flatMap((_,i)=>i%2?[0,1]:[1,0]))});
 const out=await alignInBrowser("사랑해","喜歡",{model,threshold:0,margin:0});
 assert.equal(out.source.length,1);
 assert.ok(out.target.length>0);
});
test("very long source abstains without loading a model",async()=>{
 const result=await alignInBrowser(Array(25).fill("사랑").join(" "),"我喜歡");
 assert.deepEqual(result.links,[]);
 assert.ok(result.reason);
});
