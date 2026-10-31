// Explicitly invoked, bounded paid caption timing for the approved generated demo voice.
// Never reads or uploads phone call audio.
import { readFile,writeFile } from 'node:fs/promises';
import { resolve,basename,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readConfig } from '../lib/config.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(!args.includes('--run-paid')){console.error('Use --run-paid only after authorization for this generated narration transcription.');process.exitCode=1;}
else try{
  const audioPath=resolve(root,'artifacts/demo-narration-master.wav');
  const scriptPath=resolve(root,'artifacts/demo-narration-draft.txt');
  const output=resolve(root,'artifacts/demo-narration-timestamps.json');
  if(basename(audioPath)!=='demo-narration-master.wav'||existsSync(output))throw new Error('Preserve existing caption timing output; no request made.');
  const script=(await readFile(scriptPath,'utf8')).trim();
  const metadata=JSON.parse(await readFile(resolve(root,'artifacts/demo-narration.json'),'utf8'));
  if(createHash('sha256').update(script).digest('hex')!==metadata.inputSha256)throw new Error('Approved narration script changed; no request made.');
  const bytes=await readFile(audioPath);if(bytes.length>8_000_000)throw new Error('Generated narration exceeds the bounded transcription size.');
  const config=readConfig(root);if(!config.openaiKey)throw new Error('OpenAI key is not configured.');
  const form=new FormData();form.append('file',new Blob([bytes],{type:'audio/wav'}),'demo-narration-master.wav');
  form.append('model','whisper-1');form.append('language','en');form.append('response_format','verbose_json');
  form.append('timestamp_granularities[]','word');form.append('timestamp_granularities[]','segment');
  form.append('prompt','CommonGround. Street market, delivery access, storefront, public agendas, AI advocates, proposal versions, browser notifications.');
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${config.openaiKey}`},body:form,signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw new Error(`OpenAI transcription failed (HTTP ${response.status}); no response body or credentials logged.`);
  const result=await response.json();if(!result.words?.length||!result.segments?.length)throw new Error('Transcription returned no word/segment timing.');
  await writeFile(output,JSON.stringify({model:'whisper-1',purpose:'Caption timing for approved generated narration only',audio:audioPath,approvedScriptSha256:metadata.inputSha256,createdAt:new Date().toISOString(),...result},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({output,words:result.words.length,segments:result.segments.length,duration:result.duration,status:'Timing obtained; caption text must retain the approved script.'}));
}catch(error){console.error(error.message);process.exitCode=1;}
