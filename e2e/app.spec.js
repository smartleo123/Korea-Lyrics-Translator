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

test('artist search shows titles from lyric and backup catalogs',async({page})=>{
 await page.route('https://lrclib.net/api/search?*',route=>route.fulfill({json:[
  {id:91,trackName:'밤편지',artistName:'IU',albumName:'Palette',instrumental:false}
 ]}));
 await page.route('https://itunes.apple.com/search?*',route=>route.fulfill({json:{results:[
  {kind:'song',trackId:101,trackName:'좋은 날',artistName:'IU',collectionName:'Real'}
 ]}}));
 await page.goto('/');
 await page.locator('#artist').fill('IU');
 await page.locator('#findArtistSongs').click();
 console.log('ARTIST DEBUG',await page.locator('#songSearchStatus').textContent());
 await expect(page.locator('#songResults')).toContainText('밤편지');
 await expect(page.locator('#songResults')).toContainText('좋은 날');
 await expect(page.locator('#songResults')).toContainText('尋找韓文歌詞');
});

test('selected Korean lyrics load but English-only results do not overwrite manual text',async({page})=>{
 await page.route('https://lrclib.net/api/search?*',route=>route.fulfill({json:[
  {id:44,trackName:'예시',artistName:'가수',albumName:'Original',instrumental:false}
 ]}));
 await page.route('https://itunes.apple.com/search?*',route=>route.fulfill({json:{results:[]}}));
 await page.route('https://lrclib.net/api/get/44',route=>route.fulfill({json:{
  id:44,trackName:'예시',artistName:'가수',plainLyrics:'I love you forever\nYou are my sunshine'
 }}));
 await page.goto('/');
 await page.locator('#source').fill('기존 한국어 가사');
 await page.locator('#title').fill('예시');
 await page.locator('#findLyrics').click();
 console.log('SEARCH DEBUG',await page.locator('#songSearchStatus').textContent());
 await page.getByRole('button',{name:'帶入歌詞'}).click();
 await expect(page.locator('#songSearchStatus')).toContainText('讀取失敗');
 await expect(page.locator('#source')).toHaveValue('기존 한국어 가사');
});
