// Align timestamp evidence to the approved script; never replace approved wording.
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root=process.cwd();
const script=(await readFile(resolve(root,'artifacts/demo-narration-draft.txt'),'utf8')).trim();
const timing=JSON.parse(await readFile(resolve(root,'artifacts/demo-narration-timestamps.json'),'utf8'));
const hash=createHash('sha256').update(script).digest('hex');
if(hash!==timing.approvedScriptSha256)throw new Error('Approved script changed after timing.');
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const words=script.split(/\s+/);const approved=[];let a='';
for(const word of words){const start=a.length;a+=norm(word);approved.push({text:word,start,end:a.length});}
const transcript=[];let b='';
for(const word of timing.words){const start=b.length;b+=norm(word.word);for(let i=start;i<b.length;i++)transcript[i]={start:word.start,end:word.end};}
const cols=b.length+1;const dp=new Uint16Array((a.length+1)*cols);
for(let i=0;i<=a.length;i++)dp[i*cols]=i;for(let j=0;j<=b.length;j++)dp[j]=j;
for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i*cols+j]=Math.min(dp[(i-1)*cols+j]+1,dp[i*cols+j-1]+1,dp[(i-1)*cols+j-1]+(a[i-1]===b[j-1]?0:1));
const mapping=[];let i=a.length,j=b.length;
while(i||j){const v=dp[i*cols+j];if(i&&j&&v===dp[(i-1)*cols+j-1]+(a[i-1]===b[j-1]?0:1)){mapping[i-1]=j-1;i--;j--;}else if(i&&v===dp[(i-1)*cols+j]+1)i--;else j--;}
const distance=dp[a.length*cols+b.length];if(distance/a.length>0.05)throw new Error('Narration differs substantially from the approved script; listening review required.');
for(const word of approved){const chars=mapping.slice(word.start,word.end).filter(Number.isInteger);if(!chars.length)throw new Error(`A script word has no timing alignment: ${word.text}`);word.audioStart=transcript[Math.min(...chars)].start;word.audioEnd=transcript[Math.max(...chars)].end;}
const cues=[];let group=[];
function flush(){if(!group.length)return;const previous=cues.at(-1);const start=Math.max(previous?.end??0,group[0].audioStart),end=Math.max(start+0.08,...group.map(w=>w.audioEnd));cues.push({start,end,text:group.map(w=>w.text).join(' ')});group=[];}
for(const word of approved){if(group.length&&(group.length>=13||group.map(w=>w.text).join(' ').length+word.text.length+1>84))flush();group.push(word);if(/[.!?]$/.test(word.text))flush();}flush();
const output=resolve(root,'artifacts/demo-narration-cues.json');
const paragraphs=script.split(/\r?\n\s*\r?\n/);let at=0;
const paragraphTiming=paragraphs.map((text,index)=>{const count=text.trim().split(/\s+/).length;const first=approved[at],last=approved[at+count-1];at+=count;return{paragraph:index+1,start:first.audioStart,end:last.audioEnd,words:count};});
await writeFile(output,JSON.stringify({source:'OpenAI whisper-1 word timestamps aligned to exact approved script',approvedScriptSha256:hash,captionTimebase:'source-narration',characterEditDistance:distance,characterCount:a.length,captionCues:cues,paragraphTiming,reviewStatus:'Exact approved wording preserved; listening review pending'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,cues:cues.length,approvedWords:words.length,characterEditDistance:distance,characterCount:a.length,paragraphTiming}));
