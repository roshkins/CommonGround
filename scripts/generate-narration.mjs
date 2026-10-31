import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readConfig } from '../lib/config.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const value=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
if(args.includes('--help')||!value('--input')||!value('--output')){
  console.log('Generate an approved narration script with OpenAI TTS.\nUsage: node scripts/generate-narration.mjs --input <text-file> --output <new.wav> [--voice marin]');
  if(!args.includes('--help'))process.exitCode=1;
}else{
  try{
    const inputPath=resolve(value('--input'));const outputPath=resolve(value('--output'));
    if(extname(outputPath).toLowerCase()!=='.wav')throw new Error('Use a .wav output file.');
    const metadataPath=outputPath.replace(/\.wav$/i,'.json');
    if(existsSync(outputPath)||existsSync(metadataPath))throw new Error('Output or metadata exists; choose a new path before making a paid speech request.');
    const input=(await readFile(inputPath,'utf8')).trim();
    if(!input||input.length>4096)throw new Error('The approved narration text must contain 1–4096 characters.');
    const voice=value('--voice')||'marin';
    if(!['marin','cedar'].includes(voice))throw new Error('Choose the reviewed narration voice: marin or cedar.');
    const config=readConfig(root);
    if(!config.openaiKey)throw new Error('OPENAI_API_KEY is not configured on the server.');
    const instructions='Speak in clear, energetic, confident English, with warm purpose and a natural conversational rhythm. Use a brisk but easily understood pace, approximately 150 words per minute. Keep pauses short. Pronounce CommonGround as Common Ground. Emphasize the final phrase: The agents propose; people approve. Avoid hype, shouting, theatrical delivery, and added words. Read only the provided text.';
    const response=await fetch('https://api.openai.com/v1/audio/speech',{
      method:'POST',signal:AbortSignal.timeout(90000),
      headers:{Authorization:`Bearer ${config.openaiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'gpt-4o-mini-tts',voice,input,instructions,response_format:'wav'}),
    });
    if(!response.ok)throw new Error(`OpenAI speech generation failed (HTTP ${response.status}). No credentials or response body were logged.`);
    const wav=Buffer.from(await response.arrayBuffer());
    if(wav.length<44||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw new Error('OpenAI did not return a valid WAV file.');
    await mkdir(dirname(outputPath),{recursive:true});
    await writeFile(outputPath,wav,{flag:'wx'});
    const metadata={model:'gpt-4o-mini-tts',voice,format:'wav',inputFile:inputPath,inputSha256:createHash('sha256').update(input).digest('hex'),characters:input.length,words:input.split(/\s+/).length,bytes:wav.length,createdAt:new Date().toISOString(),disclosure:'AI-generated narration',reviewStatus:'Awaiting user listening review',notes:'One-off Speech API artifact for the October 31, 2026 demo; not the application live-conversation transport.'};
    await writeFile(metadataPath,JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({output:outputPath,metadata:metadataPath,voice,words:metadata.words,bytes:wav.length,reviewStatus:metadata.reviewStatus}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
