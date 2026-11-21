import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 page.on('pageerror',err=>console.log('BROWSER PAGE ERROR:',err.stack||err.message));
 page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER CONSOLE ERROR:',msg.text());});
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

