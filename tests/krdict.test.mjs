import test from "node:test";
import assert from "node:assert/strict";
import {dictionaryGloss,fillDictionaryGlosses,keyForLemma} from "../src/krdict.js";

test("real Korean learner dictionary shard schema yields a concise Chinese gloss",()=>{
 assert.equal(dictionaryGloss([[["讲，述说","用语言表达"]]],x=>x.replace("讲","講")),"講");
 assert.equal(dictionaryGloss([[["一种意思","第一义"],["另一种意思","第二义"]]]),"一种意思");
 assert.equal(dictionaryGloss([[["一种意思","第一义"],["另一种意思","第二义"]]],x=>x.replaceAll("种","種"),"這是另一種意思"),"另一種意思");
 assert.equal(dictionaryGloss([[["一","1"],["二","2"],["三","3"],["四","4"]]]),"一");
 assert.equal(dictionaryGloss(undefined),"");
 assert.equal(keyForLemma("말하다"),"b9d0");
 assert.equal(keyForLemma("?"),null);
});
test("missing word is filled with keyed Korean dictionary meaning without changing Hanja",async()=>{
 const lines=[[{text:"좋을",type:"native",gloss:"",lemma:"좋다"},{text:" ",type:"plain"},
  {text:"고백",type:"hanja",gloss:"告白"}]];
 const requested=[];
 const fetcher=async(url)=>{requested.push(url);return {ok:true,json:async()=>({"좋다":[[["好，良好","质量好"]]]})};};
 const result=await fillDictionaryGlosses(lines,{fetcher,converter:x=>x.replace("良好","良好"),baseUrl:"https://dictionary.example/"});
 assert.equal(result.matched,1);
 assert.equal(lines[0][0].gloss,"好");
 assert.equal(lines[0][0].translationSource,"KRDICT");
 assert.equal(lines[0][0].text,"좋을");
 assert.equal(lines[0][2].gloss,"告白");
 assert.ok(requested.some(url=>url.endsWith("/c88b.json")));
});
test("polysemous, corrupt, or unavailable dictionary data is not invented",async()=>{
 const lines=[[{text:"하나",type:"native",gloss:""},{text:"둘",type:"native",gloss:""}]];
 const fetcher=async(url)=>url.endsWith("d558.json")
  ?{ok:true,json:async()=>({"하나":[[["一","数字"],["单一","只有一个"]]]})}
  :{ok:false,status:404,json:async()=>({})};
 const r=await fillDictionaryGlosses(lines,{fetcher,converter:x=>x,baseUrl:"https://dictionary.test/"});
 assert.equal(r.matched,1);
 assert.ok(r.failed>=1);
 assert.equal(lines[0][0].gloss,"一");
 assert.equal(lines[0][1].gloss,"");
});
test("source and user-supplied glosses always outrank dictionary",async()=>{
 const lines=[[{text:"좋다",type:"native",gloss:"我設定的詞義",source:"custom"}]];
 let calls=0;
 const r=await fillDictionaryGlosses(lines,{fetcher:async()=>{calls++;throw Error("unexpected")},converter:x=>x});
 assert.equal(r.matched,0);
 assert.equal(calls,0);
});
test("aborted dictionary requests never mutate annotations",async()=>{
 const signal=new AbortController();signal.abort();
 const lines=[[{text:"좋다",type:"native",gloss:""}]];
 const result=await fillDictionaryGlosses(lines,{signal:signal.signal,converter:x=>x});
 assert.equal(result.aborted,true);
 assert.equal(lines[0][0].gloss,"");
});

test("long lyrics search all unique dictionary shards instead of silently truncating at 32",async()=>{
 const candidates=Array.from({length:38},(_,i)=>({
  text:String.fromCharCode(0xac00+i*28),type:"native",gloss:""
 }));
 let requestCount=0;
 const lines=[candidates];
 const fetcher=async()=>{requestCount++;return {ok:true,json:async()=>({})};};
 const result=await fillDictionaryGlosses(lines,{fetcher,converter:x=>x,baseUrl:"https://all-shards.test/"});
 assert.equal(result.skippedShards,0);
 assert.equal(requestCount,38);
 assert.equal(result.failed,0);
});
test("explicit shard budgets report omitted shards and preserve unknown words",async()=>{
 const lines=[[{text:"가가",type:"native",gloss:""},{text:"나나",type:"native",gloss:""}]];
 const result=await fillDictionaryGlosses(lines,{fetcher:async()=>({ok:true,json:async()=>({})}),converter:x=>x,baseUrl:"https://limited-shards.test/",maxShards:1});
 assert.equal(result.skippedShards,1);
 assert.ok(lines[0].every(w=>!w.gloss));
});

test("selects one plausible sense using line translation, not slash-separated synonyms",async()=>{
 const lines=[[{text:"얼음장",type:"native",gloss:""}]];
 const fetcher=async()=>({ok:true,json:async()=>({"얼음장":[[["冰層，冰塊，冰磚","用於形容非常寒冷的物體"]]]})});
 const out=await fillDictionaryGlosses(lines,{fetcher,baseUrl:"https://sense.test/",converter:x=>x,contexts:[{text:"像冰塊一樣冷酷"}]});
 assert.equal(out.matched,1);
 assert.equal(lines[0][0].gloss,"冰塊");
 assert.equal(lines[0][0].gloss.includes("／"),false);
});
