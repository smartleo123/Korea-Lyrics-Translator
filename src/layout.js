// Preserve the user's pasted line and stanza structure without trimming.
// Textarea normalizes most newlines, but clipboard content may include CRLF.
export function splitLyrics(input){
  return String(input).replace(/\r\n?/g,"\n").split("\n");
}
export function reconstructLyrics(lines){
  return lines.join("\n");
}
