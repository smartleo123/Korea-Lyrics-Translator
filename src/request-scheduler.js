// Shared, rate-limited client-side request scheduler for the free MyMemory API.
// Prevents word lookup and line translation from making simultaneous bursts.
export function createRequestScheduler({intervalMs=300}={}){
 const queue=[];let busy=false,lastStart=0,timer=null;
 function pump(){
  if(busy||timer!==null)return;
  while(queue.length&&queue[0].signal?.aborted){
   const item=queue.shift();item.reject(new Error("請求已取消"));
  }
  if(!queue.length)return;
  const delay=Math.max(0,lastStart+intervalMs-Date.now());
  timer=setTimeout(()=>{
   timer=null;
   const job=queue.shift();
   if(!job)return pump();
   if(job.signal?.aborted){job.reject(new Error("請求已取消"));pump();return;}
   lastStart=Date.now();busy=true;
   Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{busy=false;pump();});
  },delay);
 }
 return {
  run(task,{signal}={}){
   if(signal?.aborted)return Promise.reject(new Error("請求已取消"));
   return new Promise((resolve,reject)=>{queue.push({task,signal,resolve,reject});pump();});
  },
  get pending(){return queue.length;}
 };
}
export const translationScheduler=createRequestScheduler({intervalMs:300});
