import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCache,saveCache} from '../src/cache.js';
import {createRequestScheduler} from '../src/request-scheduler.js';
test('bounded cache saves values and migrates legacy word dictionaries',()=>{
 const data=new Map();
 const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
 storage.setItem('old',JSON.stringify({사랑:'≈愛',눈물:'眼淚'}));
 assert.equal(loadCache(storage,'old').사랑,'愛');
 assert.equal(saveCache(storage,'new',{a:'1',b:'2',c:'3'},{max:2}),true);
 assert.deepEqual(Object.keys(loadCache(storage,'new')).sort(),['b','c']);
});
test('cache expiration drops stale records and malformed content',()=>{
 const storage={getItem:()=>JSON.stringify({version:2,entries:[
  {key:'오래',value:'舊',time:0},{key:'지금',value:'現在',time:Date.now()}
 ]})};
 const result=loadCache(storage,'key',{ttlDays:3});
 assert.equal(result['지금'],'現在');
 assert.equal(result['오래'],undefined);
});
test('translation scheduler serializes jobs and respects aborted pending work',async()=>{
 const scheduler=createRequestScheduler({intervalMs:0});
 const order=[],abort=new AbortController();
 const first=scheduler.run(async()=>{order.push(1);return 1;});
 const second=scheduler.run(async()=>{order.push(2);return 2;});
 const third=scheduler.run(async()=>{order.push(3);return 3;},{signal:abort.signal}).catch(()=>null);
 abort.abort();
 assert.deepEqual(await Promise.all([first,second,third]),[1,2,null]);
 assert.deepEqual(order,[1,2]);
});
