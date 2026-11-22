import test from "node:test";
import assert from "node:assert/strict";
import {prepareBrowserTranslator,usableTranslation,LANGUAGE_PAIR} from "../src/browser-translation.js";
test("checks exact supported Korean / traditional Chinese language pair",async()=>{
 let options;
 const api={availability:async opts=>{options=opts;return "available";},create:async()=>({translate:async()=> "你好"})};
 const translator=await prepareBrowserTranslator({api});
 assert.deepEqual(options,LANGUAGE_PAIR);
 assert.equal(await translator.translate(),"你好");
});
test("unsupported and downloadable models are not automatically downloaded",async()=>{
 let created=false;
 const api={availability:async()=> "downloadable",create:async()=>{created=true;return {translate:async()=>""}}};
 assert.equal(await prepareBrowserTranslator({api}),null);
 assert.equal(created,false);
 await prepareBrowserTranslator({api,allowDownload:true});
 assert.equal(created,true);
});
test("translator sanity checks reject untranslated and fake century conversions",()=>{
 assert.equal(usableTranslation("19 世紀的過時風格","我們的 19's kitsch"),"");
 assert.equal(usableTranslation("19's kitsch","19's kitsch"),"");
 assert.equal(usableTranslation("無對應","안녕"),"無對應");
 assert.equal(usableTranslation("你好","안녕"),"你好");
});
