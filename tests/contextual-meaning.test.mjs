import test from 'node:test';
import assert from 'node:assert/strict';
import {
 deriveContextGloss,withoutPart,selectContextCandidates,
 enrichContextGlosses,restoreCachedContextGlosses,displayAnnotation
} from '../src/contextual-meaning.js';
const tok=(text,type='native',gloss='',extra={})=>({text,type,gloss,...extra});
test('contrastive Chinese sentence delta extracts contextual meaning generically',()=>{
 const r=deriveContextGloss('我現在就想走，但有點遠','我現在就想走，但有點');
 assert.equal(r?.gloss,'遠');
 assert.equal(deriveContextGloss('我現在想去，但有點遠','我希望你別哭'),null);
 assert.equal(deriveContextGloss('我喜歡你','我喜歡')?.gloss,'你');
});
test('remove selected Garu surface while preserving source order',()=>{
 const parts=[tok('당장'),tok(' ','plain'),tok('가고'),tok(' ','plain'),tok('싶지만')];
 assert.equal(withoutPart(parts,0),'가고 싶지만');
 assert.equal(withoutPart(parts,2),'당장 싶지만');
 assert.equal(withoutPart(parts,1),'');
});
test('context retranslation replaces wrong independent gloss without a song-specific map',async()=>{
 const line=[tok('가고','native','錯誤翻譯',{translationSource:'MyMemory'}),tok(' ','plain'),tok('싶지만')];
 const rows=[{text:'我想去，但還不能'}];
 const cache={};
 const fetcher=async(url)=>{
  const query=new URL(url).searchParams.get('q');
  assert.equal(query,'싶지만');
  return {ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'但還不能'}})};
 };
 const result=await enrichContextGlosses([line],rows,{fetcher,cache,max:1});
 assert.equal(result.matched,1);
 assert.equal(line[0].gloss,'我想去');
 assert.equal(line[0].translationSource,'sentence-contrast');
 const cloned=[tok('가고','native','',{source:'pos'}),tok(' ','plain'),tok('싶지만')];
 restoreCachedContextGlosses([cloned],rows,cache);
 assert.equal(cloned[0].gloss,'我想去');
});
test('Hanja origin and sentence-specific meaning remain separate',async()=>{
 const line=[tok('당장','hanja','當場',{source:'dictionary'}),tok(' ','plain'),tok('가고','native','走',{translationSource:'lexicon'})];
 const fetcher=async()=>({ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'想走'}})});
 await enrichContextGlosses([line],[{text:'現在就想走'}],{fetcher,max:1});
 assert.equal(line[0].gloss,'當場');
 assert.equal(line[0].contextGloss,'現在就');
 assert.equal(displayAnnotation(line[0]),'當場 · 現在就');
});
test('unstable sentence translations do not replace existing glosses',async()=>{
 const line=[tok('노래','native','歌曲',{translationSource:'lexicon'}),tok(' ','plain'),tok('사랑해')];
 const fetcher=async()=>({ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'我不會再看見那個人了'}})});
 await enrichContextGlosses([line],[{text:'你的歌曲非常美麗'}],{fetcher,max:1});
 assert.equal(line[0].gloss,'歌曲');
 assert.equal(line[0].contextGloss,undefined);
});
test('deduplicated contextual candidates skip isolated one-word sentences',()=>{
 const lines=[[tok('머니까')],[tok('머니까'),tok(' ','plain'),tok('당장')]];
 const rows=[{text:'遠'},{text:'因為很遠，現在就'}];
 assert.equal(selectContextCandidates(lines,rows).every(x=>x.i===1),true);
});
