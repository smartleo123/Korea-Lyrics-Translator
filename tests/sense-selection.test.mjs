import test from "node:test";
import assert from "node:assert/strict";
import {selectSense,senseOptions,selectLineGlosses} from "../src/sense-selection.js";
test("only the most likely meaning is displayed, not multiple dictionary meanings",()=>{
 assert.equal(selectSense(["冰層／冰塊，冰磚"],"像冰塊一樣冷酷"),"冰塊");
 assert.equal(selectSense(["香甜／甜蜜，甜美"],"甜蜜的詛咒"),"甜蜜");
 assert.equal(selectSense(["消退／退去"],"會逐漸消退"),"消退");
 assert.equal(selectSense(["如果／假如"],""),"如果");
 assert.equal(selectSense(["多，充滿，滿滿地／擠滿"],"充滿香氣的迷宮"),"充滿");
});
test("neutral dictionary order wins ties and traditional conversion does not invent translations",()=>{
 assert.deepEqual(senseOptions("容易，簡單／輕易"),["容易","簡單","輕易"]);
 assert.equal(selectSense(["容易，簡單／輕易"],"難以置信"),"容易");
 assert.equal(selectSense([""],"任意"),"");
});
test("context selection applies consistently to built-in glosses but preserves custom and Hanja",()=>{
 const lines=[[{text:"가득",type:"native",gloss:"多，充滿／滿滿地",translationSource:"lexicon"},
   {text:" ",type:"plain"},
   {text:"연극",type:"hanja",gloss:"演劇"},
   {text:" ",type:"plain"},
   {text:"달콤한",type:"native",gloss:"香甜／甜蜜",source:"custom"}]];
 const out=selectLineGlosses(lines,[{text:"充滿香氣的戲劇"}])[0];
 assert.equal(out[0].gloss,"充滿");
 assert.equal(out[0].rawGloss,"多，充滿／滿滿地");
 assert.equal(out[2].gloss,"演劇");
 assert.equal(out[4].gloss,"香甜／甜蜜");
});
