// API-key-free browser embeddings. Similarity estimates are not verified translations.
export const MODEL_ID="Xenova/paraphrase-multilingual-MiniLM-L12-v2";
let modelPromise;
export function getLocalModel(){
 if(!modelPromise)modelPromise=import("@huggingface/transformers")
  .then(({pipeline})=>pipeline("feature-extraction",MODEL_ID,{dtype:"q8",device:"wasm"}))
  .catch(error=>{modelPromise=null;throw error;});
 return modelPromise;
}
export function splitKorean(text){return String(text||"").match(/[가-힣]+/g)||[];}
export function splitChinese(text,segmenter=new Intl.Segmenter("zh-Hant",{granularity:"word"})){
 return [...segmenter.segment(String(text||""))].map(x=>x.segment.trim()).filter(x=>/[\u3400-\u9fff]/u.test(x));
}
export function similarity(a,b){
 if(!a?.length||a.length!==b?.length)return -1;
 let dot=0,aa=0,bb=0;
 for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}
 return aa&&bb?dot/Math.sqrt(aa*bb):-1;
}
export function alignVectors(source,target,srcVectors,tgtVectors,{threshold=.54,margin=.04}={}){
 if(srcVectors.length!==source.length||tgtVectors.length!==target.length)throw new Error("向量數量不符");
 if(!source.length||!target.length)return [];
 const scores=srcVectors.map(a=>tgtVectors.map(b=>similarity(a,b)));
 const right=scores.map(row=>row.indexOf(Math.max(...row)));
 const left=target.map((_,j)=>{
  let best=-Infinity,index=-1;
  scores.forEach((row,i)=>{if(row[j]>best){best=row[j];index=i;}});
  return index;
 });
 return right.flatMap((j,i)=>{
  const score=scores[i][j];
  const other=Math.max(-1,...scores[i].filter((_,k)=>k!==j));
  return left[j]===i&&score>=threshold&&(target.length===1||score-other>=margin)
   ?[{source:i,target:j,similarity:score}]:[];
 });
}
export async function alignInBrowser(korean,chinese,{model,threshold=.54,margin=.04}={}){
 const source=splitKorean(korean),target=splitChinese(chinese);
 if(!source.length||!target.length||source.length>24||target.length>32)
  return {source,target,links:[],reason:"內容過長或沒有可對齊詞彙"};
 const extractor=model||await getLocalModel();
 const tokens=[...source,...target];
 const result=await extractor(tokens,{pooling:"mean",normalize:true});
 if(result.dims?.length!==2||result.dims[0]!==tokens.length)throw new Error("模型輸出格式異常");
 const dim=result.dims[1];
 const vectors=tokens.map((_,i)=>result.data.slice(i*dim,(i+1)*dim));
 return {source,target,links:alignVectors(source,target,vectors.slice(0,source.length),vectors.slice(source.length),{threshold,margin})};
}
