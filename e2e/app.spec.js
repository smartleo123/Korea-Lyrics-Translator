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

test('Korean lyric forms from screenshot get meanings and preserve the source lines',async({page})=>{
 await page.route('https://api.mymemory.translated.net/**',route=>route.fulfill({json:{
  responseStatus:200,responseData:{translatedText:'詞義'}
 }}));
 await page.goto('/');
 await expect(page.locator('#annotate')).toBeEnabled({timeout:30000});
 await page.locator('#source').fill('꾸준한 네 좋아요\n비싼 보석함\n솔직함');
 await page.locator('#annotate').click();
 await expect(page.locator('.lyric-entry')).toHaveCount(3,{timeout:45000});
 const text=await page.locator('#output').innerText();
 console.log('COMPOUND DEBUG',await page.locator('#output').innerHTML());
 expect(text).toContain('持續不懈的');
 expect(text).toContain('昂貴的');
 expect(text).toContain('보석(寶石)함(盒)');
 expect(text).toContain('坦率');
 await expect(page.locator('#loading')).toBeHidden();
});

