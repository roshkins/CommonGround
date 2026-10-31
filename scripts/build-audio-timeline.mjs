// Build a reviewed dialogue/narration edit from real source audio. No API calls.
import { readFile,writeFile,mkdir,stat } from 'node:fs/promises';
import { resolve,dirname,extname } from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const argv=process.argv.slice(2);const opt=k=>{const i=argv.indexOf(k);return i<0?null:argv[i+1];};
const bin=n=>existsSync(`C:\\Users\\Rashi\\path\\${n}.exe`)?`C:\\Users\\Rashi\\path\\${n}.exe`:n;
async function run(n,args){return new Promise((done,fail)=>{const p=spawn(bin(n),args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err=(err+x).slice(-4000));p.on('error',fail);p.on('exit',c=>c===0?done(out):fail(Error(`${n} failed (${c}): ${err}`)));});}
async function probe(f){return JSON.parse(await run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,sample_rate,channels','-of','json',f]));}
const number=(v,name,max=3600)=>{if(!Number.isFinite(v)||v<0||v>max)throw Error(`Invalid ${name}.`);return v;};
async function main(){
  if(!opt('--manifest')||!opt('--output')){console.log('Usage: node scripts/build-audio-timeline.mjs --manifest audio-edit.json --output new.wav\nManifest: {targetSeconds,pieces:[{file,sourceStart,duration,at,label?}]}. Sources are relative to manifest.');return;}
  const manifestPath=resolve(opt('--manifest')),raw=await readFile(manifestPath),m=JSON.parse(raw),output=resolve(opt('--output'));const base=dirname(manifestPath);
  if(extname(output).toLowerCase()!=='.wav'||existsSync(output)||existsSync(output.replace(/\.wav$/i,'.json')))throw Error('Choose a new .wav output path.');
  const target=number(m.targetSeconds,'target duration',300);if(!target||!Array.isArray(m.pieces)||!m.pieces.length||m.pieces.length>40)throw Error('Provide a bounded nonempty audio timeline.');
  const pieces=m.pieces.map(p=>({file:resolve(base,p.file),sourceStart:number(p.sourceStart??0,'source start'),duration:number(p.duration,'piece duration',300),at:number(p.at,'piece position',300),label:p.label??null}));
  for(const p of pieces){if(p.duration<=0||p.at+p.duration>target+0.01)throw Error('Audio piece exceeds the target.');const info=await probe(p.file);if(!info.streams.some(s=>s.codec_type==='audio')||p.sourceStart+p.duration>Number(info.format.duration)+0.01)throw Error('Audio piece exceeds its source recording.');}
  const ordered=[...pieces].sort((a,b)=>a.at-b.at);for(let i=1;i<ordered.length;i++)if(ordered[i].at<ordered[i-1].at+ordered[i-1].duration-0.01)throw Error('Voice pieces overlap; choose intelligible reviewed cuts.');
  const args=['-hide_banner','-loglevel','error'];for(const p of pieces)args.push('-i',p.file);const filters=[`anullsrc=r=48000:cl=mono,atrim=duration=${target}[base]`];
  for(let i=0;i<pieces.length;i++){const p=pieces[i];filters.push(`[${i}:a]atrim=start=${p.sourceStart}:duration=${p.duration},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=mono,adelay=${Math.round(p.at*1000)}:all=1[p${i}]`);}
  filters.push(`[base]${pieces.map((_,i)=>`[p${i}]`).join('')}amix=inputs=${pieces.length+1}:duration=first:normalize=0[out]`);await mkdir(dirname(output),{recursive:true});
  args.push('-filter_complex',filters.join(';'),'-map','[out]','-t',String(target),'-c:a','pcm_s16le',output);await run('ffmpeg',args);
  const info=await probe(output);if(Math.abs(Number(info.format.duration)-target)>0.01)throw Error('Final audio duration verification failed.');
  const report={output,targetSeconds:target,manifestSha256:createHash('sha256').update(raw).digest('hex'),pieces,format:'48kHz mono PCM16 WAV',bytes:(await stat(output)).size,reviewStatus:'Source bounds, overlap and output duration verified; full listening review pending'};
  await writeFile(output.replace(/\.wav$/i,'.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
