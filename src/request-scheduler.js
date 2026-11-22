// Serial, rate-limited requests with prompt cancellation of queued work.
export function createRequestScheduler({intervalMs=300}={}){
 const queue=[];let busy=false,lastStart=0,timer=null;
 function cancel(job){
  const index=queue.indexOf(job);
  if(index<0)return;
  queue.splice(index,1);
  job.signal?.removeEventListener("abort",job.onAbort);
  job.reject(new Error("請求已取消"));
  if(!busy&&timer!==null&&queue.length===0){clearTimeout(timer);timer=null;}
  pump();
 }
 function pump(){
  if(busy||timer!==null||!queue.length)return;
  const delay=Math.max(0,lastStart+intervalMs-Date.now());
  timer=setTimeout(()=>{
   timer=null;
   const job=queue.shift();
   if(!job)return pump();
   job.signal?.removeEventListener("abort",job.onAbort);
   if(job.signal?.aborted){job.reject(new Error("請求已取消"));pump();return;}
   lastStart=Date.now();busy=true;
   Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{busy=false;pump();});
  },delay);
 }
 return {
  run(task,{signal}={}){
   if(signal?.aborted)return Promise.reject(new Error("請求已取消"));
   return new Promise((resolve,reject)=>{
    const job={task,signal,resolve,reject,onAbort:null};
    job.onAbort=()=>cancel(job);
    signal?.addEventListener("abort",job.onAbort,{once:true});
    queue.push(job);pump();
   });
  },
  get pending(){return queue.length;}
 };
}
export const translationScheduler=createRequestScheduler({intervalMs:300});
