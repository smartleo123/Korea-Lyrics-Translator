test('first translate sentence, then retain complete word glosses even without literal overlap',async({page})=>{
 const queryHistory=[];
 await page.route('https://api.mymemory.translated.net/**',route=>{
  const q=new URL(route.request().url()).searchParams.get('q')||'';
  queryHistory.push(q);
  const text=q.includes('머니까')&&q.includes('당장')?'我現在就想走，但是有點遠。':
   q==='머니까'?'遠':'想走';
  return route.fulfill({json:{responseStatus:200,responseData:{translatedText:text}}});
 });
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('당장 가고 싶지만 좀 머니까');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const plain=await page.locator('#output').innerText();
 expect(plain).toContain('당장');
 expect(plain).toContain('머니까');
 expect(plain).toContain('遠');
 expect(queryHistory[0]).toBe('당장 가고 싶지만 좀 머니까');
 await page.locator('#toggleChinese').click();
 await expect(page.locator('.line-translation')).toContainText('我現在就想走');
});
test('minimal lyrics placeholder, removed dictionary buttons, and downloadable PDF',async({page})=>{
 await page.route('https://api.mymemory.translated.net/**',route=>
  route.fulfill({json:{responseStatus:200,responseData:{translatedText:'愛你'}}}));
 await page.goto('/');
 await expect(page.locator('#source')).toHaveAttribute('placeholder','把韓文歌詞貼在這裡');
 await expect(page.locator('#exportDict')).toHaveCount(0);
 await expect(page.locator('#importDict')).toHaveCount(0);
 await expect(page.locator('#downloadPdf')).toBeDisabled();
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#title').fill('測試歌曲');
 await page.locator('#source').fill('사랑해\\n\\n안녕');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('#downloadPdf')).toBeEnabled();
 const downloadPromise=page.waitForEvent('download',{timeout:45000});
 await page.locator('#downloadPdf').click();
 const file=await downloadPromise;
 expect(file.suggestedFilename()).toBe('測試歌曲-詞源對照.pdf');
 const fs=await import('node:fs/promises');
 const pdf=await fs.readFile(await file.path());
 expect(pdf.subarray(0,5).toString('ascii')).toBe('%PDF-');
 expect(pdf.length).toBeGreaterThan(1000);
});

import {test,expect} from '@playwright/test';

test('long annotated lines never squeeze the left search panel',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.route('https://api.mymemory.translated.net/**',route=>
  route.fulfill({json:{responseStatus:200,responseData:{translatedText:'完整的中文翻譯'}}}));
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 const before=await page.locator('.layout > .panel').first().boundingBox();
 expect(before.width).toBeGreaterThan(400);
 await page.locator('#title').fill('Magnetic');
 await page.locator('#artist').fill('ILLIT');
 const long='내 심장이 '+('너무너무길게이어지는한국어가사'.repeat(18));
 await page.locator('#source').fill(long);
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const left=await page.locator('.layout > .panel').first().boundingBox();
 const right=await page.locator('.layout > .panel').nth(1).boundingBox();
 expect(left.width).toBeGreaterThan(400);
 expect(Math.abs(before.width-left.width)).toBeLessThan(3);
 expect(right.x).toBeGreaterThanOrEqual(left.x+left.width);
 expect(right.x+right.width).toBeLessThanOrEqual(1440);
 const overflow=await page.locator('#output').evaluate(el=>el.scrollWidth>el.clientWidth);
 expect(overflow).toBe(true);
 await expect(page.locator('#findLyrics')).toBeVisible();
});
test('showing translated long lyric lines does not shrink the input panel',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.route('https://api.mymemory.translated.net/**',route=>
  route.fulfill({json:{responseStatus:200,responseData:{translatedText:'這是一段很長的中文翻譯'.repeat(30)}}}));
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 const original=await page.locator('.layout > .panel').first().boundingBox();
 await page.locator('#source').fill('내 심장이 계속 뛰어');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.locator('#toggleChinese').click();
 await expect(page.locator('.line-translation')).toBeVisible();
 const after=await page.locator('.layout > .panel').first().boundingBox();
 expect(after.width).toBeGreaterThanOrEqual(410);
 expect(Math.abs(original.width-after.width)).toBeLessThan(2);
 expect(await page.locator('#output').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
});

test('medium viewport uses one column instead of squeezing inputs',async({page})=>{
 await page.setViewportSize({width:900,height:800});
 await page.goto('/');
 const input=await page.locator('.layout > .panel').first().boundingBox();
 const result=await page.locator('.layout > .panel').nth(1).boundingBox();
 expect(result.y).toBeGreaterThanOrEqual(input.y+input.height);
 expect(input.width).toBeGreaterThan(600);
});

test('search panel and annotations stack cleanly on small screens',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 const panels=page.locator('.layout > .panel');
 const a=await panels.first().boundingBox();
 const b=await panels.nth(1).boundingBox();
 expect(b.y).toBeGreaterThan(a.y+a.height);
 expect(a.x+a.width).toBeLessThanOrEqual(390);
 expect(b.x+b.width).toBeLessThanOrEqual(390);
});


test('Hanja spelling is preserved while contextual meaning stays in the sentence translation',async({page})=>{
 const queries=[];
 await page.route('https://api.mymemory.translated.net/**',route=>{
  const q=new URL(route.request().url()).searchParams.get('q')||'';
  queries.push(q);
  const translation=q==='당장 가고'?'現在想走':q==='가고'?'想走':q==='당장'?'現在':'不確定';
  return route.fulfill({json:{responseStatus:200,responseData:{translatedText:translation}}});
 });
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('당장 가고');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const result=await page.locator('#output').innerText();
 expect(queries[0]).toBe('당장 가고');
 expect(result).toContain('당장(當場)');
 expect(result).not.toContain('當場 ·');
 expect(result).toContain('가고');
 await page.locator('#toggleChinese').click();
 await expect(page.locator('.line-translation')).toContainText('現在想走');
});

test('sentence translation happens before word annotation and toggle reuses it',async({page})=>{
 const requests=[];
 await page.route('https://api.mymemory.translated.net/**',route=>{
  const query=new URL(route.request().url()).searchParams.get('q')||'';
  requests.push(query);
  const reply=query.includes('맘이')?'我的心很痛':'心';
  route.fulfill({json:{responseStatus:200,responseData:{translatedText:reply}}});
 });
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('내 맘이 아파와');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 expect(requests[0]).toBe('내 맘이 아파와');
 await expect(page.locator('#output')).toContainText('맘이');
 await expect(page.locator('#output .line-translation')).toHaveCount(0);
 const before=requests.length;
 await page.locator('#toggleChinese').click();
 await expect(page.locator('#output .line-translation')).toHaveCount(1);
 expect(requests.length).toBe(before);
 await page.locator('#toggleChinese').click();
 await expect(page.locator('#output .line-translation')).toHaveCount(0);
 expect(requests.length).toBe(before);
});
test('a provided Chinese sentence guides annotation before word-only translation',async({page})=>{
 const requests=[];
 await page.route('https://api.mymemory.translated.net/**',route=>{
  const q=new URL(route.request().url()).searchParams.get('q')||'';
  requests.push(q);
  route.fulfill({json:{responseStatus:200,responseData:{translatedText:'我的心'}}});
 });
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('내 맘이 아파와');
 await page.locator('details.optional-translation summary').click();
 await page.locator('#providedChinese').fill('我的心感到疼痛');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 expect(requests).not.toContain('내 맘이 아파와');
 await expect(page.locator('#output')).toContainText('맘이');
 await page.locator('#toggleChinese').click();
 await expect(page.locator('.line-translation')).toContainText('我的心感到疼痛');
});

test('fullscreen reading mode enlarges annotated lyrics, remembers font size and exits',async({page})=>{
 await page.route('https://api.mymemory.translated.net/**',route=>route.fulfill({json:{
  responseStatus:200,responseData:{translatedText:'我愛你'}
 }}));
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await expect(page.locator('#openReader')).toBeDisabled();
 await page.locator('#title').fill('閱讀測試');
 await page.locator('#source').fill('사랑해\n\n안녕');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('#openReader')).toBeEnabled();
 await page.locator('#openReader').click();
 await expect(page.locator('#readerDialog')).toBeVisible();
 await expect(page.locator('#readerTitle')).toHaveText('閱讀測試');
 await expect(page.locator('#readerLyrics .lyric-entry')).toHaveCount(3);
 await expect(page.locator('#readerLyrics')).toContainText('사랑');
 await expect(page.locator('#readerFontSize')).toHaveText('30px');
 await page.getByRole('button',{name:'放大歌詞字體'}).click();
 await expect(page.locator('#readerFontSize')).toHaveText('34px');
 await expect(page.locator('#readerLyrics')).toHaveCSS('font-size','34px');
 await page.getByRole('button',{name:'縮小歌詞字體'}).click();
 await expect(page.locator('#readerFontSize')).toHaveText('30px');
 await page.keyboard.press('Escape');
 await expect(page.locator('#readerDialog')).not.toBeVisible();
 await page.locator('#openReader').click();
 await expect(page.locator('#readerDialog')).toBeVisible();
 await page.locator('#closeReader').click();
 await expect(page.locator('#readerDialog')).not.toBeVisible();
 await page.locator('#source').fill('새로 바꾼 가사');
 await expect(page.locator('#openReader')).toBeDisabled();
});
test('fullscreen reading dialog fits mobile and renders enabled Chinese translation',async({page})=>{
 await page.setViewportSize({width:375,height:667});
 await page.route('https://api.mymemory.translated.net/**',route=>route.fulfill({json:{
  responseStatus:200,responseData:{translatedText:'我愛你'}
 }}));
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('사랑해');
 await page.locator('#toggleChinese').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.locator('#openReader').click();
 await expect(page.locator('#readerDialog')).toBeVisible();
 await expect(page.locator('#readerLyrics .line-translation')).toHaveCount(1);
 const bounds=await page.locator('#readerDialog').boundingBox();
 expect(bounds.x).toBeGreaterThanOrEqual(0);
 expect(bounds.x+bounds.width).toBeLessThanOrEqual(376);
 await page.locator('#closeReader').click();
 await expect(page.locator('#readerDialog')).not.toBeVisible();
});

test('usage help opens from upper-right, consolidates text, and closes by button or Escape',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#helpOpen')).toBeVisible();
 await expect(page.locator('#helpDialog')).not.toBeVisible();
 await expect(page.locator('header p')).toHaveCount(0);
 await expect(page.locator('.callout')).toHaveCount(0);
 await expect(page.locator('.foot')).toHaveCount(0);
 await page.locator('#helpOpen').click();
 await expect(page.locator('#helpDialog')).toBeVisible();
 await expect(page.locator('#helpDialog')).toContainText('紅色漢字詞');
 await expect(page.locator('#helpDialog')).toContainText('LRCLIB 搜尋');
 await expect(page.locator('#helpDialog')).toContainText('Garu 形態分析');
 await expect(page.locator('#helpDialog')).toContainText('非完美語意判斷');
 await page.getByRole('button',{name:'關閉使用說明'}).click();
 await expect(page.locator('#helpDialog')).not.toBeVisible();
 await page.locator('#helpOpen').click();
 await page.keyboard.press('Escape');
 await expect(page.locator('#helpDialog')).not.toBeVisible();
 await page.locator('#source').fill('사랑해');
 await expect(page.locator('#source')).toHaveValue('사랑해');
});
test('usage help remains usable on narrow mobile screens',async({page})=>{
 await page.setViewportSize({width:375,height:667});
 await page.goto('/');
 await expect(page.locator('#helpOpen')).toBeInViewport();
 await page.locator('#helpOpen').click();
 await expect(page.locator('#helpDialog')).toBeVisible();
 const bounds=await page.locator('#helpDialog').boundingBox();
 expect(bounds.x).toBeGreaterThanOrEqual(0);
 expect(bounds.x+bounds.width).toBeLessThanOrEqual(375);
 await page.getByRole('button',{name:'關閉使用說明'}).click();
 await expect(page.locator('#helpDialog')).not.toBeVisible();
});


test.beforeEach(async({page})=>{
 page.on('pageerror',err=>console.log('BROWSER PAGE ERROR:',err.stack||err.message));
 page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER CONSOLE ERROR:',msg.text());});
});

test('output heading follows song changes immediately, even during translation',async({page})=>{
 await page.route('https://api.mymemory.translated.net/**',async route=>{
  await new Promise(resolve=>setTimeout(resolve,350));
  try{await route.fulfill({json:{responseStatus:200,responseData:{translatedText:'翻譯'}}});}catch{}
 });
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#title').fill("It's Me");
 await expect(page.locator('#outputTitle')).toHaveText("02　It's Me");
 await page.locator('#source').fill('처음보는낯선문장과 가사가 계속이어져');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeVisible();
 await page.locator('#title').fill('Catch the Stars');
 await expect(page.locator('#outputTitle')).toHaveText('02　Catch the Stars');
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('#outputTitle')).toHaveText('02　Catch the Stars');
 await page.locator('#source').fill('새로운 노래의 가사');
 await expect(page.locator('#outputTitle')).toHaveText('02　Catch the Stars');
 await page.locator('#clear').click();
 await expect(page.locator('#outputTitle')).toHaveText('02　歌詞標註結果');
});
test('manual lyrics preserve stanza breaks and show optional Chinese line translation',async({page})=>{
 await page.route('https://api.mymemory.translated.net/**',route=>{
  const q=new URL(route.request().url()).searchParams.get('q')||'';
  route.fulfill({json:{responseStatus:200,responseData:{translatedText:q.includes('사랑')?'我愛你':'你好'}}});
 });
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('사랑해\n\n안녕');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 console.log('LYRIC DEBUG',await page.locator('#notice').textContent(),(await page.locator('#output').innerHTML()).slice(0,200));
 await expect(page.locator('.lyric-entry')).toHaveCount(3);
 await expect(page.locator('.lyric-entry').nth(1)).toHaveText('');
 await page.locator('#toggleChinese').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('.line-translation')).toHaveCount(2);
 await expect(page.locator('.lyric-entry').nth(1)).toHaveText('');
 await page.locator('#toggleChinese').click();
 await expect(page.locator('.line-translation')).toHaveCount(0);
});

test('LRCLIB artist search gives one compact list of song titles',async({page})=>{
 await page.route('https://lrclib.net/api/search?*',route=>route.fulfill({json:[
  {id:91,trackName:'밤편지',artistName:'IU',albumName:'Palette'},
  {id:92,trackName:'밤편지',artistName:'IU',albumName:'Live'},
  {id:93,trackName:'좋은 날',artistName:'IU',albumName:'Real'},
  {id:94,trackName:'IU Song',artistName:'Someone Else'}
 ]}));
 await page.goto('/');
 await page.locator('#artist').fill('IU');
 await page.locator('#findArtistSongs').click();
 await expect(page.locator('#songResults')).toContainText('밤편지');
 await expect(page.locator('#songResults')).toContainText('좋은 날');
 await expect(page.locator('.song-option')).toHaveCount(2);
 await expect(page.locator('.song-option select')).toHaveCount(1);
 await expect(page.locator('#songResults')).not.toContainText('Someone Else');
});

test('LRCLIB title lookup does not replace manual input with English lyrics',async({page})=>{
 await page.route('https://lrclib.net/api/search?*',route=>route.fulfill({json:[
  {id:44,trackName:'예시',artistName:'가수',albumName:'Original'}
 ]}));
 await page.route('https://lrclib.net/api/get/44',route=>route.fulfill({json:{
  id:44,trackName:'예시',artistName:'가수',
  plainLyrics:'I love you forever\nYou are my sunshine'
 }}));
 await page.goto('/');
 await page.locator('#source').fill('기존 한국어 가사');
 await page.locator('#title').fill('예시');
 await page.locator('#findLyrics').click();
 await expect(page.locator('#songResults')).toContainText('예시');
 await page.getByRole('button',{name:'帶入歌詞'}).first().click();
 await expect(page.locator('#songSearchStatus')).toContainText('讀取失敗');
 await expect(page.locator('#source')).toHaveValue('기존 한국어 가사');
});

test('song and artist inputs use precise LRCLIB metadata search',async({page})=>{
 let requested='';
 await page.route('https://lrclib.net/api/search?*',route=>{
  requested=route.request().url();
  return route.fulfill({json:[{
   id:106,trackName:"It's Me",artistName:'ILLIT',albumName:'Original'
  }]});
 });
 await page.goto('/');
 await page.locator('#title').fill('It′s Me');
 await page.locator('#artist').fill('ILLIT');
 await page.locator('#findLyrics').click();
 await expect(page.locator('#songResults')).toContainText("It's Me");
 const params=new URL(requested).searchParams;
 expect(params.get('track_name')).toBe("It's Me");
 expect(params.get('artist_name')).toBe('ILLIT');
 expect(params.has('q')).toBe(false);
});

test('editing lyrics while a selected song loads never overwrites manual work',async({page})=>{
 await page.route('https://lrclib.net/api/search?*',route=>route.fulfill({json:[
  {id:78,trackName:'테스트',artistName:'가수',albumName:'Single'}
 ]}));
 await page.route('https://lrclib.net/api/get/78',async route=>{
  await new Promise(resolve=>setTimeout(resolve,350));
  try{await route.fulfill({json:{
   id:78,trackName:'테스트',artistName:'가수',
   plainLyrics:'사랑해 너를\\n많이 보고 싶어'
  }});}catch{}
 });
 await page.goto('/');
 await page.locator('#title').fill('테스트');
 await page.locator('#findLyrics').click();
 await page.getByRole('button',{name:'帶入歌詞'}).click();
 await page.locator('#source').fill('내가 직접 입력한 가사');
 await expect(page.locator('#source')).toHaveValue('내가 직접 입력한 가사');
 await page.waitForTimeout(600);
 await expect(page.locator('#source')).toHaveValue('내가 직접 입력한 가사');
});

test('BESTie artist search retries Korean stage name when English query misses',async({page})=>{
 const searched=[];
 await page.route('https://lrclib.net/api/search?*',route=>{
  const q=new URL(route.request().url()).searchParams.get('q');
  searched.push(q);
  return route.fulfill({json:q==='베스티'?[
   {id:750,trackName:'연애의 조건',artistName:'베스티 (BESTie)',albumName:'Hot Baby'}
  ]:[]});
 });
 await page.goto('/');
 await page.locator('#artist').fill('bestie');
 await page.locator('#findArtistSongs').click();
 await expect(page.locator('#songResults')).toContainText('연애의 조건');
 expect(searched).toEqual(['bestie','베스티']);
});
test('empty lyric catalog does not imply the artist does not exist',async({page})=>{
 await page.route('https://lrclib.net/api/search?*',route=>route.fulfill({json:[]}));
 await page.goto('/');
 await page.locator('#artist').fill('bestie');
 await page.locator('#findArtistSongs').click();
 await expect(page.locator('#songSearchStatus')).toContainText('不代表歌手不存在');
});

test('unverified lyric words preserve Hangul and line structure without forced meanings',async({page})=>{
 await page.route('https://api.mymemory.translated.net/**',route=>route.fulfill({json:{
  responseStatus:200,responseData:{translatedText:'沒有可確認的對應詞義'}
 }}));
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('꾸준한 네 좋아요\n비싼 보석함\n솔직함');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('.lyric-entry')).toHaveCount(3);
 const text=await page.locator('#output').innerText();
 expect(text).toContain('꾸준한');
 expect(text).toContain('비싼');
 expect(text).toContain('보석');
 expect(text).toContain('솔직함');
 expect(text).not.toContain('摳門鬼');
});

test('editing provided Chinese after annotation invalidates outdated results',async({page})=>{
 await page.route('https://api.mymemory.translated.net/**',route=>
  route.fulfill({json:{responseStatus:200,responseData:{translatedText:'你好'}}}));
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('사랑해');
 await page.locator('details.optional-translation').evaluate(el=>el.open=true);
 await page.locator('#providedChinese').fill('我愛你');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.locator('#toggleChinese').click();
 await expect(page.locator('.line-translation')).toContainText('我愛你');
 await page.locator('#providedChinese').fill('新的人工譯文');
 await expect(page.locator('.line-translation')).toHaveCount(0);
 await expect(page.locator('#download')).toBeDisabled();
 await expect(page.locator('#downloadPdf')).toBeDisabled();
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('.line-translation')).toContainText('新的人工譯文');
});


test('annotation UI contains neither local AI alignment nor uncertainty prefixes',async({page})=>{
 await page.route('https://api.mymemory.translated.net/**',route=>route.fulfill({json:{responseStatus:200,responseData:{translatedText:'? 不確定詞義'}}}));
 await page.goto('/');
 await expect(page.locator('#runLocalAI')).toHaveCount(0);
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('사랑해');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('#output')).not.toContainText('(?');
 await expect(page.locator('#stats')).not.toContainText('（?）');
});

test('free Korean dictionary fills missing words without overwriting Hanja',async({page})=>{
 await page.route('https://api.mymemory.translated.net/**',route=>route.fulfill({json:{
  responseStatus:200,responseData:{translatedText:'我看見一隻松鼠'}
 }}));
 await page.route('https://cdn.jsdelivr.net/gh/basickorean/**',route=>{
  return route.fulfill({json:{'다람쥐':[[['松鼠','一種小動物']]]}});
 });
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('다람쥐');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('#output')).toContainText('다람쥐(松鼠)');
 await expect(page.locator('#runLocalAI')).toHaveCount(0);
});

test('word coverage reports missing and dictionary-sourced counts without AI alignment',async({page})=>{
 await page.route('https://api.mymemory.translated.net/**',route=>
   route.fulfill({json:{responseStatus:200,responseData:{translatedText:'松鼠'}}}));
 await page.route('https://cdn.jsdelivr.net/gh/basickorean/**',route=>
   route.fulfill({json:{'다람쥐':[[['松鼠','小動物']]]}}));
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('다람쥐');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('#stats')).toContainText('開源詞典補充 1');
 await expect(page.locator('#stats')).toContainText('未標註 0');
 await expect(page.locator('#runLocalAI')).toHaveCount(0);
});
test('annotating a sentence no longer invokes deleted-word retranslation',async({page})=>{
 const requests=[];
 await page.route('https://api.mymemory.translated.net/**',route=>{
  requests.push(new URL(route.request().url()).searchParams.get('q'));
  return route.fulfill({json:{responseStatus:200,responseData:{translatedText:'今天晚上要散步'}}});
 });
 await page.route('https://cdn.jsdelivr.net/gh/basickorean/**',route=>route.fulfill({json:{}}));
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('오늘 밤 산책할 거야');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 assertNoDeletedRequests(requests);
});
function assertNoDeletedRequests(requests){
 // The complete Korean sentence is translated once; remaining requests must
 // be isolated vocabulary, never a sentence with a word removed.
 const full='오늘 밤 산책할 거야';
 for(const query of requests){
  if(query===full)continue;
  if(query.includes(' ')&&query!==full)throw new Error('Unexpected deleted-word translation: '+query);
 }
}

test('automatic browser sentence translator overrides MyMemory without a second button',async({page})=>{
 await page.addInitScript(()=>{
  window.Translator={
   availability:async()=> "available",
   create:async()=>({translate:async()=> "我喜歡自由"})
  };
 });
 let sentenceRequests=0;
 await page.route('https://api.mymemory.translated.net/**',route=>{
  const q=new URL(route.request().url()).searchParams.get('q');
  if(q==='자유를 좋아해')sentenceRequests++;
  return route.fulfill({json:{responseStatus:200,responseData:{translatedText:'舊的翻譯'}}});
 });
 await page.route('https://cdn.jsdelivr.net/gh/basickorean/**',route=>route.fulfill({json:{}}));
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await expect(page.locator('#enableBrowserTranslator')).toHaveCount(0);
 await page.locator('#source').fill('자유를 좋아해');
 await page.locator('#annotate').click();
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.locator('#toggleChinese').click();
 await expect(page.locator('#output')).toContainText('我喜歡自由');
 if(sentenceRequests)throw new Error('The browser translator should handle the entire Korean line');
});
