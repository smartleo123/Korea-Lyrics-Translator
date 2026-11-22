// An offline, transparent *smoke* metric. Not a claim of semantic accuracy.
export function evaluateTranslation(dataset,predictions){
 const cases=dataset.cases.map(sample=>{
  const output=String(predictions[sample.id]||"");
  const covered=(sample.requiredAny||[]).some(s=>output.includes(s));
  const violations=(sample.forbidden||[]).filter(s=>output.includes(s));
  return {id:sample.id,hasOutput:!!output,keywordCoverage:covered,forbiddenHits:violations,reference:sample.reference,output};
 });
 const attempted=cases.filter(x=>x.hasOutput);
 return {total:cases.length,attempted:attempted.length,
  keywordCoverage:attempted.length?attempted.filter(x=>x.keywordCoverage).length/attempted.length:null,
  forbiddenRate:attempted.length?attempted.filter(x=>x.forbiddenHits.length).length/attempted.length:null,
  cases};
}
