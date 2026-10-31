// Render a genuine continuous CDP screencast at its original capture timing.
// No browser access, image generation, narration, editorial still holds, or paid calls.
import { readFile,writeFile,mkdir,copyFile,stat } from 'node:fs/promises';
import { resolve,dirname,join,extname } from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID,createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const argv=process.argv.slice(2);const opt=k=>{const i=argv.indexOf(k);return i<0?null:argv[i+1];};
const bin=name=>existsSync(`C:\\Users\\Rashi\\path\\${name}.exe`)?`C:\\Users\\Rashi\\path\\${name}.exe`:name;
async function run(name,args,cwd){return new Promise((done,fail)=>{const p=spawn(bin(name),args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>err=(err+s).slice(-5000));p.on('error',fail);p.on('exit',c=>c===0?done(out):fail(Error(`${name} failed (${c}): ${err}`)));});}
async function probe(file){return JSON.parse(await run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration','-of','json',file]));}
async function main(){
  if(!opt('--manifest')||!opt('--output')){console.log('Usage: node scripts/render-screencast.mjs --manifest capture.json --output new.mp4');return;}
  const manifestPath=resolve(opt('--manifest')),output=resolve(opt('--output'));const raw=await readFile(manifestPath);const m=JSON.parse(raw);
  const lossless=argv.includes('--lossless');const suffix=lossless?'.mkv':'.mp4';
  if(extname(output).toLowerCase()!==suffix||existsSync(output)||existsSync(output.replace(/\.(mp4|mkv)$/i,'.json')))throw Error(`Choose a new ${suffix} output path.`);
  if(!['cdp-screencast','cdp-png-screenshot-sequence','cdp-screenshot-recording'].includes(m.captureKind)||!m.frames?.length||m.frames.length>20000)throw Error('Expected a bounded genuine continuous CDP capture manifest.');
  const frames=m.frames.map(f=>({file:resolve(dirname(manifestPath),f.file),timestamp:f.timestamp}));
  for(let i=0;i<frames.length;i++)if(!Number.isFinite(frames[i].timestamp)||(i&&frames[i].timestamp<=frames[i-1].timestamp))throw Error('Capture timestamps must strictly increase.');
  const end=m.endTimestamp;if(!Number.isFinite(end)||end<=frames.at(-1).timestamp)throw Error('Provide the actual capture end timestamp.');
  const duration=end-frames[0].timestamp;if(duration<=0||duration>600)throw Error('Capture exceeds the ten-minute bound.');
  const first=(await probe(frames[0].file)).streams.find(s=>s.codec_type==='video');if(!first?.width||!first.height)throw Error('Cannot determine source dimensions.');
  if(first.width%2||first.height%2)throw Error('Use an even native browser viewport size before recording.');
  if(lossless&&(first.width!==1920||first.height!==1080||frames.some(f=>extname(f.file).toLowerCase()!=='.png')))throw Error('Lossless native capture requires1920x1080 PNG source frames, without resizing.');
  const work=join(dirname(output),`.continuous-${randomUUID()}`);await mkdir(work,{recursive:true});const list=['ffconcat version 1.0'];let maxGap=0;
  const copiedNames=[];
  for(let i=0;i<frames.length;i++){const name=`frame-${String(i).padStart(6,'0')}${extname(frames[i].file).toLowerCase()}`;copiedNames.push(name);await copyFile(frames[i].file,join(work,name));const gap=(frames[i+1]?.timestamp??end)-frames[i].timestamp;maxGap=Math.max(maxGap,gap);list.push(`file '${name}'`,`duration ${gap.toFixed(9)}`);}
  list.push(`file '${copiedNames.at(-1)}'`);await writeFile(join(work,'frames.ffconcat'),list.join('\n')+'\n');
  const encode=lossless?['-c:v','ffv1','-level','3','-coder','1','-context','1','-pix_fmt','bgr0']:['-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart'];
  await run('ffmpeg',['-hide_banner','-loglevel','error','-f','concat','-safe','0','-i','frames.ffconcat','-vf','fps=30,setsar=1','-t',String(duration),'-an',...encode,output],work);
  const verified=await probe(output);const stream=verified.streams.find(s=>s.codec_type==='video');
  const encodedDuration=Number(stream?.duration??verified.format.duration);
  if(!stream||stream.codec_name!==(lossless?'ffv1':'h264')||stream.width!==first.width||stream.height!==first.height||Math.abs(encodedDuration-duration)>0.05)throw Error('Native dimension or capture duration verification failed.');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-i',output,'-f','null',process.platform==='win32'?'NUL':'/dev/null']);
  let pixelProof=null;
  if(lossless){const digest=async file=>(await run('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-frames:v','1','-an','-c:v','rawvideo','-pix_fmt','rgb24','-f','hash','-hash','sha256','-'])).trim();const a=await digest(frames[0].file),b=await digest(output);if(a!==b)throw Error('Lossless RGB frame verification failed.');pixelProof={firstSourceAndDecodedRGBIdentical:true,sha256:a.replace(/^SHA256=/,'')};}
  const report={output,sourceManifest:manifestPath,sourceManifestSha256:createHash('sha256').update(raw).digest('hex'),captureKind:m.captureKind,timestampBasis:m.timestampBasis??'Original CDP frame metadata',sourceFrames:frames.length,sourceFirstTimestamp:frames[0].timestamp,sourceEndTimestamp:end,sourceDurationSeconds:duration,encodedDurationSeconds:encodedDuration,width:stream.width,height:stream.height,encodedFps:stream.r_frame_rate,encodedFrames:Number(stream.nb_frames)||null,losslessRGB:lossless,pixelProof,maximumSourceGapSeconds:maxGap,bytes:(await stat(output)).size,audio:'none—silent genuine browser recording',timing:m.timestampBasis?'Source receipt intervals preserved; CFR output repeats unchanged browser frames':'Original capture intervals preserved; CFR output repeats unchanged browser frames',reviewStatus:'Native dimensions, capture timing and full decode verified; human playback review pending',workDirectory:work};
  await writeFile(output.replace(/\.(mp4|mkv)$/i,'.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
