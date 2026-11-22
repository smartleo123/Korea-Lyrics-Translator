import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluateTranslation} from "../benchmark/translation-evaluation.js";
const dataset=JSON.parse(readFileSync(new URL("../benchmark/translation-cases.json",import.meta.url),"utf8"));
test("quality fixture has meaningful Korean snippets, references and checked failure markers",()=>{
 assert.ok(dataset.cases.length>=12);
 assert.equal(new Set(dataset.cases.map(x=>x.id)).size,dataset.cases.length);
 for(const item of dataset.cases){
  assert.ok(/[가-힣]/.test(item.source),item.id);
  assert.ok(item.reference&&item.requiredAny.length&&item.forbidden.length,item.id);
 }
});
test("evaluation measures both required meaning signals and known harmful mistranslations",()=>{
 const outputs=Object.fromEntries(dataset.cases.map(x=>[x.id,x.reference]));
 const good=evaluateTranslation(dataset,outputs);
 assert.equal(good.attempted,dataset.cases.length);
 assert.equal(good.keywordCoverage,1);
 assert.equal(good.forbiddenRate,0);
 outputs["style-freedom"]="我們的 19 世紀風格";
 const bad=evaluateTranslation(dataset,outputs);
 assert.ok(bad.forbiddenRate>0);
});
test("missing predictions are not fabricated as scores",()=>{
 const result=evaluateTranslation(dataset,{});
 assert.equal(result.attempted,0);
 assert.equal(result.keywordCoverage,null);
});

test("observed user-provided baseline has known meaning errors; a passing unit test does not hide them",()=>{
 const observed=Object.fromEntries(dataset.cases.map(x=>[x.id,x.observed]));
 const baseline=evaluateTranslation(dataset,observed);
 assert.equal(baseline.attempted,dataset.cases.length);
 assert.ok(baseline.forbiddenRate>0);
 const failures=baseline.cases.filter(x=>x.forbiddenHits.length).map(x=>x.id);
 assert.ok(failures.includes("style-freedom"));
 assert.ok(failures.includes("opposite-attraction"));
});
