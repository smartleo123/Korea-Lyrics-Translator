import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.route('https://musicbrainz.org/ws/2/**',route=>route.fulfill({json:{artists:[]}}));
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

test('artist search displays only one MusicBrainz catalog',async({page})=>{
 const id='6d4ff5b0-49ee-4c58-8f33-bf1f2ac71489';
 await page.unroute('https://musicbrainz.org/ws/2/**');
 await page.route('https://musicbrainz.org/ws/2/**',route=>{
  if(new URL(route.request().url()).pathname.endsWith('/artist/'))
   return route.fulfill({json:{artists:[{id,name:'IU',country:'KR'}]}});
  return route.fulfill({json:{'recording-count':1,recordings:[{id:'a',title:'밤편지'}]}});
 });
 await page.goto('/');
 await page.locator('#artist').fill('IU');
 await page.locator('#findArtistSongs').click();
 await expect(page.locator('#artistDirectory')).toBeVisible();
 await expect(page.locator('#songResults')).toBeEmpty();
 await page.locator('.artist-choices button').first().click();
 await expect(page.locator('#artistDirectory')).toContainText('밤편지');
 await expect(page.locator('#songResults')).toBeEmpty();
});

test('title search uses MusicBrainz and English lyrics never overwrite pasted input',async({page})=>{
 await page.unroute('https://musicbrainz.org/ws/2/**');
 await page.route('https://musicbrainz.org/ws/2/**',route=>route.fulfill({json:{recordings:[
  {id:'rec44',title:'예시','artist-credit':[{artist:{id:'6d4ff5b0-49ee-4c58-8f33-bf1f2ac71489',name:'가수'}}]}
 ]}}));
 await page.route('https://lrclib.net/api/search?*',route=>route.fulfill({json:[
  {id:44,trackName:'예시',artistName:'가수',albumName:'Original',instrumental:false}
 ]}));
 await page.route('https://lrclib.net/api/get/44',route=>route.fulfill({json:{
  id:44,trackName:'예시',artistName:'가수',plainLyrics:'I love you forever\\nYou are my sunshine'
 }}));
 await page.goto('/');
 await page.locator('#source').fill('기존 한국어 가사');
 await page.locator('#title').fill('예시');
 await page.locator('#findLyrics').click();
 await expect(page.locator('#songResults')).toContainText('예시');
 await page.getByRole('button',{name:'找韓文歌詞'}).first().click();
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

test('artist identity allows loading multiple pages and selecting lyric lookup',async({page})=>{
 const mbid='6d4ff5b0-49ee-4c58-8f33-bf1f2ac71489';
 await page.unroute('https://musicbrainz.org/ws/2/**');
 await page.route('https://musicbrainz.org/ws/2/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/artist/'))return route.fulfill({json:{artists:[
   {id:mbid,name:'IU',country:'KR',aliases:[{name:'아이유'}],score:100}
  ]}});
  const offset=Number(url.searchParams.get('offset')||0);
  return route.fulfill({json:{
   'recording-count':4,
   recordings:offset===0?[
    {id:'a',title:'첫 번째 노래'},{id:'b',title:'첫 번째 노래'}
   ]:[
    {id:'c',title:'두 번째 노래'},{id:'d',title:'세 번째 노래'}
   ]
  }});
 });
 await page.route('https://lrclib.net/api/search?*',route=>route.fulfill({json:[]}));
 await page.route('https://itunes.apple.com/search?*',route=>route.fulfill({json:{results:[]}}));
 await page.goto('/');
 await page.locator('#artist').fill('IU');
 await page.locator('#findArtistSongs').click();
 await expect(page.locator('#artistDirectory')).toBeVisible();
 await page.locator('.artist-choices button').first().click();
 await expect(page.locator('#artistDirectory')).toContainText('첫 번째 노래');
 await expect(page.locator('#artistDirectory .directory-track')).toHaveCount(1);
 await page.getByRole('button',{name:'載入更多歌曲（下一頁）'}).click();
 await expect(page.locator('#artistDirectory')).toContainText('세 번째 노래');
 await expect(page.locator('#artistDirectory .directory-track')).toHaveCount(3);
 await expect(page.getByRole('button',{name:'載入更多歌曲（下一頁）'})).toBeHidden();
 await page.getByRole('button',{name:'找韓文歌詞'}).first().click();
 await expect(page.locator('#songSearchStatus')).toContainText('無法帶入歌詞');
});
