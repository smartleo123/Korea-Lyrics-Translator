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
 assert.equal(deriveContextGloss('我喜歡你','我喜歡'),null);
});
test('remove selected Garu surface while preserving source order',()=>{
 const parts=[tok('당장'),tok(' ','plain'),tok('가고'),tok(' ','plain'),tok('싶지만')];
 assert.equal(withoutPart(parts,0),'가고 싶지만');
 assert.equal(withoutPart(parts,2),'당장 싶지만');
 assert.equal(withoutPart(parts,1),'');
});
test('contrastive probes never overwrite existing machine, lexical or dictionary meanings',async()=>{
 const line=[tok('가고','native','既有詞義',{translationSource:'MyMemory'}),tok(' ','plain'),tok('싶지만')];
 const cache={};
 const fetcher=async()=>{throw Error('should not call translator for annotated tokens')};
 const result=await enrichContextGlosses([line],[{text:'我想去，但還不能'}],{fetcher,cache,max:1});
 assert.equal(result.attempted,1); // unresolved second token can still be considered
 assert.equal(line[0].gloss,'既有詞義');
});
test('only strongly stable deletion changes can fill an empty gloss',()=>{
 const line=[tok('말','native',''),tok(' ','plain'),tok('친구')];
 const row={text:'今天我們一起快快樂樂說話'};
 const cache={'말 친구|0|今天我們一起快快樂樂說話':JSON.stringify({gloss:'話',confidence:.92})};
 restoreCachedContextGlosses([line],[row],cache);
 assert.equal(line[0].gloss,'話');
});
test('attested Hanja and its existing meaning are never modified by contrastive hints',async()=>{
 const line=[tok('당장','hanja','當場',{source:'dictionary'}),tok(' ','plain'),tok('가고','native','走',{translationSource:'lexicon'})];
 let calls=0;
 await enrichContextGlosses([line],[{text:'現在就想走'}],{fetcher:async()=>{calls++;throw Error('Unexpected call')}});
 assert.equal(calls,0);
 assert.equal(line[0].gloss,'當場');
 assert.equal(line[0].contextGloss,undefined);
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
test('weak contrastive evidence must not overwrite an existing meaning',async()=>{
 const line=[tok('사랑','native','愛',{translationSource:'lexicon'}),tok(' ','plain'),tok('노래')];
 const cache={'사랑 노래|0|我喜歡這首歌':JSON.stringify({gloss:'不相干',confidence:.2})};
 restoreCachedContextGlosses([line],[{text:'我喜歡這首歌'}],cache);
 assert.equal(line[0].gloss,'愛');
});

test('unreliable and question-mark-prefixed machine glosses are not displayed',()=>{
 const p=tok('잘못된','native','? 似乎是某個詞');
 assert.equal(displayAnnotation(p),'');
 assert.equal(displayAnnotation(tok('어휘','native','中文字',{unverifiedGloss:true})),'');
 assert.equal(displayAnnotation(tok('어휘','native','可靠詞義')),'可靠詞義');
 assert.equal(displayAnnotation(tok('왜','native','為什麼？')),'為什麼？');
});

test('preexisting weak context cache cannot overwrite an attested or newly looked-up gloss',()=>{
 const first=[tok('사랑','native','愛',{translationSource:'garu-lemma'}),tok(' ','plain'),tok('노래')];
 const cache={'사랑 노래|0|我喜歡這首歌':JSON.stringify({gloss:'不相干',confidence:.99})};
 restoreCachedContextGlosses([first],[{text:'我喜歡這首歌'}],cache);
 assert.equal(first[0].gloss,'愛');
});
test('unstable full sentence rewriting does not yield a lexical gloss',()=>{
 assert.equal(deriveContextGloss('我想去，但有點遠','我還想去'),null);
 assert.equal(deriveContextGloss('你好嗎','你好'),null);
});
