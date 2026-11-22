// Chrome's built-in Translator API: no API key, no hosted model.
// A language pack may need a user-initiated download. All features are optional.
export const LANGUAGE_PAIR=Object.freeze({sourceLanguage:"ko",targetLanguage:"zh-Hant"});
let readyTranslator;
export async function prepareBrowserTranslator({
 api=globalThis.Translator,allowDownload=false,userGesture=false,onDownload=()=>{}
}={}){
 if(readyTranslator&&api===globalThis.Translator)return readyTranslator;
 if(!api||typeof api.availability!=="function"||typeof api.create!=="function")return null;
 // In a direct user click, call create synchronously before the first await:
 // a downloadable Chrome language pack requires transient user activation.
 if(!userGesture){
  let availability;
  try{availability=await api.availability({...LANGUAGE_PAIR});}catch{return null;}
  if(availability!=="available")return null;
 }
 try{
  const translator=await api.create({
   ...LANGUAGE_PAIR,
   monitor(monitor){monitor?.addEventListener?.("downloadprogress",event=>{
    onDownload(Math.round((event.loaded||0)*100));
   });}
  });
  if(typeof translator?.translate!=="function")return null;
  if(api===globalThis.Translator)readyTranslator=translator;
  return translator;
 }catch{return null;}
}
export function usableTranslation(result,source){
 const value=typeof result==="string"?result.trim():"";
 if(!value||value===source)return "";
 if(/[가-힣]/u.test(value)&&/[가-힣]/u.test(source)&&!/[㐀-鿿]/u.test(value))return "";
 if(!/[㐀-鿿]/u.test(value)&&/[가-힣]/u.test(source))return "";
 // A literal number followed by a possessive suffix does not mean "century".
 // This is a general numeral/date sanity check, not a song-specific translation.
 if(/\d+\s*['’]s\b/i.test(source)&&/\d+\s*世紀/u.test(value))return "";
 return value;
}
