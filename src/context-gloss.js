// Surface-form safeguards for common Korean lyric inflections and homophones.
// A dictionary entry for 말 (馬) or 맘 (媽媽) is NOT evidence that the word
// means horse or mother in "한 말은" or "내 맘이". Only apply these vetted
// exact eojeol readings; do not guess Hanja from a Chinese translation.
// Original spacing, punctuation, and custom user corrections are preserved.
export const LYRIC_CONTEXT_FORMS={
 "맘이":{type:"native",gloss:"心（主格）"},
 "맘은":{type:"native",gloss:"心（主題）"},
 "맘을":{type:"native",gloss:"心（受詞）"},
 "맘":{type:"native",gloss:"心"},
 "마음이":{type:"native",gloss:"心（主格）"},
 "아파와":{type:"native",gloss:"痛起來／感到心痛"},
 "아파":{type:"native",gloss:"痛"},
 "아팠어":{type:"native",gloss:"曾經很痛"},
 "보일":{type:"native",gloss:"看見／看起來的"},
 "보일 때마다":{type:"native",gloss:"每當看見時"},
 "말은":{type:"native",gloss:"話語（主題）"},
 "말을":{type:"native",gloss:"話語（受詞）"},
 "말이":{type:"native",gloss:"話語（主格）"},
 "거짓말":{type:"native",gloss:"謊言"},
 "거짓말은":{type:"native",gloss:"謊言（主題）"},
 "하얀":{type:"native",gloss:"潔白的"},
 "하얗게":{type:"native",gloss:"潔白地"},
 "방금":{type:"native",gloss:"剛剛"},
 "가끔":{type:"native",gloss:"偶爾"},
 "아주":{type:"native",gloss:"非常"},
 "진짜":{type:"native",gloss:"真的"},
 "때마다":{type:"native",gloss:"每當……時"},
 "네가":{type:"native",gloss:"你（主格）"},
 "내":{type:"native",gloss:"我的"},
 "있던":{type:"native",gloss:"曾經有過／存在過的"},
 "거야":{type:"native",gloss:"是這樣的／會如此"}
};
const HANGUL=/^[가-힣]+$/;
function fixRun(parts,run,forms,custom){
 if(!run.length)return run;
 const surface=run.map(part=>part.text).join("");
 const reading=forms[surface];
 if(!reading||!HANGUL.test(surface))return run;
 // User-specific corrections override all automatic interpretation.
 if(custom[surface]||run.some(part=>part.source==="custom"||custom[part.text]))return run;
 return [{text:surface,type:reading.type,gloss:reading.gloss,
  source:"context-surface",translationSource:"curated-context"}];
}
export function resolveLyricSurface(parts,{forms=LYRIC_CONTEXT_FORMS,custom={}}={}){
 const result=[];let run=[];
 const flush=()=>{result.push(...fixRun(parts,run,forms,custom));run=[];};
 for(const part of parts){
  if(HANGUL.test(part.text)){
   run.push(part);
  }else{
   flush();result.push(part);
  }
 }
 flush();
 return result;
}
