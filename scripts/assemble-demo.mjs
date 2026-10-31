// Assemble genuine browser recording frames/clips with approved narration and captions.
// No browser access, screenshots, API calls, or narration generation occurs here.
import { readFile,writeFile,mkdir,copyFile,access } from 'node:fs/promises';
import { dirname,resolve,join,extname } from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { randomUUID,createHash } from 'node:crypto';

const args=process.argv.slice(2);const opt=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const binary=name=>{const windows=`C:\\Users\\Rashi\\path\\${name}.exe`;return existsSync(windows)?windows:name;};
async function run(name,argv,cwd,extraEnv={}){return new Promise((done,fail)=>{const p=spawn(binary(name),argv,{cwd,env:{...process.env,...extraEnv},windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>{err=(err+x).slice(-7000);});p.on('error',fail);p.on('exit',code=>code===0?done(out):fail(new Error(`${name} failed (${code}): ${err}`)));});}
async function probe(file){return JSON.parse(await run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate,sample_rate,channels,duration,nb_frames','-of','json',file]));}
const num=(x,name,min=0,max=3600)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw new Error(`Invalid ${name}.`);return x;};
const clock=x=>{const ms=Math.round(x*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
function wrapCaption(text){const words=text.trim().split(/\s+/);const lines=[''];for(const word of words){if(lines.at(-1).length+word.length>46&&lines.at(-1))lines.push(word);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}return lines.join('\n');}

export function approximateCaptions(text,duration){
  const phrases=(text.replace(/\s+/g,' ').trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).flatMap(s=>{
    const words=s.trim().split(/\s+/),parts=[];for(let i=0;i<words.length;i+=13)parts.push(words.slice(i,i+13).join(' '));return parts;
  });
  const total=phrases.reduce((n,s)=>n+s.split(/\s+/).length,0);let at=0;
  return phrases.map((s,i)=>{const end=i===phrases.length-1?duration:at+duration*s.split(/\s+/).length/total;const cue={start:at,end,text:s};at=end;return cue;});
}

async function main(){
  if(args.includes('--help')||!opt('--manifest')||!opt('--output')){
    console.log('Usage: node scripts/assemble-demo.mjs --manifest <edit.json> --output <new.mp4>\nManifest: {frames:[{file,timestamp}],endTimestamp?,narration,script?,captions?,captionCues?,targetSeconds?,editedWaits:false}. Timestamps are original capture seconds. For an explicitly labeled edited screen walkthrough, set captureKind:"edited-screen-walkthrough" and each frame displaySeconds. Alternatively use clips:[{file,start,duration}]. Paths are relative to manifest.');
    return;
  }
  const manifestPath=resolve(opt('--manifest'));const manifest=JSON.parse(await readFile(manifestPath,'utf8'));const base=dirname(manifestPath);const output=resolve(opt('--output'));
  let sourceCrop=null;
  if(manifest.sourceCrop){const c=manifest.sourceCrop;sourceCrop={x:num(c.x??0,'crop x',0,10000),y:num(c.y??0,'crop y',0,10000),width:num(c.width??c.w,'crop width',1,10000),height:num(c.height??c.h,'crop height',1,10000)};if(Object.values(sourceCrop).some(n=>!Number.isInteger(n)))throw new Error('Source crop coordinates must be whole pixels.');}
  const cropFilter=sourceCrop?`crop=w=${sourceCrop.width}:h=${sourceCrop.height}:x=${sourceCrop.x}:y=${sourceCrop.y}:exact=1,`:'';
  const layoutFilter=manifest.fullFrame
    ?`${cropFilter}fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`
    :`${cropFilter}fps=30,scale=1920:936:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:0:color=black,setsar=1`;
  if(extname(output).toLowerCase()!=='.mp4')throw new Error('Use a new .mp4 output path.');
  if(existsSync(output)||existsSync(output.replace(/\.mp4$/i,'.srt'))||existsSync(output.replace(/\.mp4$/i,'.json')))throw new Error('Output or review sidecar exists; choose a new path to preserve the reviewed export.');
  const path=value=>{if(typeof value!=='string'||!value)throw new Error('A media path is required.');return resolve(base,value);};
  const losslessIntermediate=Boolean(manifest.losslessIntermediate),intermediateSuffix=losslessIntermediate?'.mkv':'.mp4';
  const intermediateEncode=losslessIntermediate?['-c:v','ffv1','-level','3','-coder','1','-context','1','-pix_fmt','bgr0']:['-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p'];
  const finalCrf=manifest.finalCrf??18,finalPreset=manifest.finalPreset??'fast';
  if(!Number.isInteger(finalCrf)||finalCrf<0||finalCrf>28||!['fast','medium','slow'].includes(finalPreset))throw new Error('Invalid final encoding quality.');
  let narration=path(manifest.narration);await access(narration);const audio=await probe(narration);
  if(!audio.streams.some(s=>s.codec_type==='audio'))throw new Error('The narration file contains no audio.');
  const sourceAudioSeconds=Number(audio.format.duration);const work=join(dirname(output),`.assembly-${randomUUID()}`);await mkdir(work,{recursive:true});
  const narrationPauses=(manifest.narrationPauses??[]).map(p=>({afterSourceSecond:num(p.afterSourceSecond,'narration pause position',0.001,sourceAudioSeconds-0.001),seconds:num(p.seconds,'narration pause duration',0.01,30)}));
  if(narrationPauses.length>16)throw new Error('Too many narration pauses.');
  for(let i=1;i<narrationPauses.length;i++)if(narrationPauses[i].afterSourceSecond<=narrationPauses[i-1].afterSourceSecond)throw new Error('Narration pause positions must increase.');
  const shiftedTime=t=>t+narrationPauses.filter(p=>p.afterSourceSecond<=t).reduce((sum,p)=>sum+p.seconds,0);
  const audioSeconds=sourceAudioSeconds+narrationPauses.reduce((sum,p)=>sum+p.seconds,0);
  if(narrationPauses.length){
    const filters=[],parts=[];let start=0;
    for(let i=0;i<=narrationPauses.length;i++){
      const end=narrationPauses[i]?.afterSourceSecond??sourceAudioSeconds;
      filters.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}]`);parts.push(`[a${i}]`);
      if(narrationPauses[i]){filters.push(`anullsrc=r=24000:cl=mono,atrim=duration=${narrationPauses[i].seconds}[s${i}]`);parts.push(`[s${i}]`);}
      start=end;
    }
    filters.push(`${parts.join('')}concat=n=${parts.length}:v=0:a=1[out]`);const timedNarration=join(work,'timed-narration.wav');
    await run('ffmpeg',['-hide_banner','-loglevel','error','-i',narration,'-filter_complex',filters.join(';'),'-map','[out]','-c:a','pcm_s16le',timedNarration],work);narration=timedNarration;
    const timed=await probe(narration);if(Math.abs(Number(timed.format.duration)-audioSeconds)>0.02)throw new Error('Narration pause timing verification failed.');
  }
  let video;let sourceSeconds;const provenance=[];
  if(Array.isArray(manifest.frames)&&manifest.frames.length){
    if(manifest.frames.length>20000)throw new Error('The capture contains too many frames.');
    const editedWalkthrough=manifest.captureKind==='edited-screen-walkthrough';
    const frames=manifest.frames.map(f=>({file:path(f.file),timestamp:num(f.timestamp,'frame timestamp',0,1e12),...(editedWalkthrough?{displaySeconds:num(f.displaySeconds,'walkthrough frame display duration',0.1,60)}:{})}));
    if(sourceCrop){const size=(await probe(frames[0].file)).streams.find(s=>s.codec_type==='video');if(sourceCrop.x+sourceCrop.width>size.width||sourceCrop.y+sourceCrop.height>size.height)throw new Error('Source crop exceeds the captured frame.');}
    for(let i=1;i<frames.length;i++)if(frames[i].timestamp<=frames[i-1].timestamp)throw new Error('Frame timestamps must increase; preserve the original capture order.');
    const end=manifest.endTimestamp===undefined?frames.at(-1).timestamp+1/30:num(manifest.endTimestamp,'end timestamp',0,1e12);
    if(end<=frames.at(-1).timestamp)throw new Error('End timestamp must follow the final captured frame.');
    sourceSeconds=editedWalkthrough?frames.reduce((sum,f)=>sum+f.displaySeconds,0):end-frames[0].timestamp;if(sourceSeconds>600)throw new Error('Capture exceeds the ten-minute assembly bound.');
    const list=['ffconcat version 1.0'];
    for(let i=0;i<frames.length;i++){
      const name=`frame-${String(i).padStart(6,'0')}.jpg`;await copyFile(frames[i].file,join(work,name));
      const duration=editedWalkthrough?frames[i].displaySeconds:(frames[i+1]?.timestamp??end)-frames[i].timestamp;
      list.push(`file '${name}'`,`duration ${duration.toFixed(6)}`);
    }
    list.push(`file 'frame-${String(frames.length-1).padStart(6,'0')}.jpg'`);
    await writeFile(join(work,'frames.ffconcat'),list.join('\n')+'\n');
    video=join(work,`captured${intermediateSuffix}`);
    await run('ffmpeg',['-hide_banner','-loglevel','error','-f','concat','-safe','0','-i','frames.ffconcat','-t',String(sourceSeconds),'-vf',layoutFilter,'-an',...intermediateEncode,video],work);
    provenance.push({kind:editedWalkthrough?'edited-screen-walkthrough':manifest.captureKind==='cdp-screencast'?'browser-cdp-screencast-frames':'provided-timestamped-frames',label:manifest.label||null,frameCount:frames.length,firstTimestamp:frames[0].timestamp,endTimestamp:end,seconds:sourceSeconds,...(editedWalkthrough?{frames:frames.map(f=>({source:f.file,capturedAt:f.timestamp,displaySeconds:f.displaySeconds})),note:'Genuine captured states with editorial display durations; not a continuous screen recording.'}:{})});
  }else if(Array.isArray(manifest.clips)&&manifest.clips.length){
    const list=['ffconcat version 1.0'];sourceSeconds=0;
    for(let i=0;i<manifest.clips.length;i++){
      const clip=manifest.clips[i],file=path(clip.file),start=num(clip.start??0,'clip start'),duration=num(clip.duration,'clip duration',0.1,600);const info=await probe(file);
      if(start+duration>Number(info.format.duration)+0.1)throw new Error(`Clip ${i+1} exceeds its source recording.`);
      const name=`clip-${i}${intermediateSuffix}`;
      const native=info.streams.find(s=>s.codec_type==='video');
      if(manifest.copyNativeRGB&&losslessIntermediate&&manifest.fullFrame&&!clip.crop&&!sourceCrop&&start===0&&Math.abs(duration-Number(info.format.duration))<0.05&&native?.codec_name==='ffv1'&&native.pix_fmt==='bgr0'&&native.width===1920&&native.height===1080&&native.r_frame_rate==='30/1'){
        await copyFile(file,join(work,name));list.push(`file '${name}'`);sourceSeconds+=duration;provenance.push({kind:'source-recording-clip',source:file,start,duration,losslessRGBPassthrough:true});continue;
      }
      let clipCrop=sourceCrop;
      if(clip.crop){const c=clip.crop;clipCrop={x:num(c.x??0,'clip crop x',0,10000),y:num(c.y??0,'clip crop y',0,10000),width:num(c.width??c.w,'clip crop width',1,10000),height:num(c.height??c.h,'clip crop height',1,10000)};if(Object.values(clipCrop).some(n=>!Number.isInteger(n)))throw new Error('Clip crop coordinates must be whole pixels.');}
      let clipLayout=layoutFilter;
      if(clipCrop){const size=info.streams.find(s=>s.codec_type==='video');if(clipCrop.x+clipCrop.width>size.width||clipCrop.y+clipCrop.height>size.height)throw new Error(`Source crop exceeds clip ${i+1}.`);const crop=`crop=w=${clipCrop.width}:h=${clipCrop.height}:x=${clipCrop.x}:y=${clipCrop.y}:exact=1,`;clipLayout=manifest.fullFrame?`${crop}fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`:`${crop}fps=30,scale=1920:936:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:0:color=black,setsar=1`;}
      await run('ffmpeg',['-hide_banner','-loglevel','error','-ss',String(start),'-i',file,'-t',String(duration),'-vf',clipLayout,'-an',...intermediateEncode,name],work);
      list.push(`file '${name}'`);sourceSeconds+=duration;provenance.push({kind:'source-recording-clip',source:file,start,duration,...(clipCrop?{sourceCrop:clipCrop}:{})});
    }
    await writeFile(join(work,'clips.ffconcat'),list.join('\n')+'\n');video=join(work,`captured${intermediateSuffix}`);await run('ffmpeg',['-hide_banner','-loglevel','error','-f','concat','-safe','0','-i','clips.ffconcat','-c','copy',video],work);
  }else throw new Error('Supply genuine captured frames with timestamps, or source recording clips. No fabricated screen content is generated.');
  const target=manifest.targetSeconds===undefined?sourceSeconds:num(manifest.targetSeconds,'target duration',1,300);
  if(target>sourceSeconds+0.1)throw new Error('Source recording is shorter than the requested duration. Capture more footage instead of silently stretching it.');
  if(audioSeconds>target+0.1)throw new Error('Narration is longer than the target video; revise the script or explicitly edit before assembly.');
  let captions;
  if(manifest.captions){captions=await readFile(path(manifest.captions),'utf8');}
  else{
    let cues=manifest.captionCues;
    if(manifest.captionCuesFile){const supplied=JSON.parse(await readFile(path(manifest.captionCuesFile),'utf8'));cues=Array.isArray(supplied)?supplied:supplied.captionCues;}
    if(Array.isArray(cues)&&manifest.captionTimebase==='source-narration')cues=cues.map(c=>({...c,start:shiftedTime(c.start),end:shiftedTime(c.end)}));
    if(!Array.isArray(cues)){if(!manifest.script)throw new Error('Provide reviewed SRT captions, captionCues, or the approved script.');cues=approximateCaptions(await readFile(path(manifest.script),'utf8'),sourceAudioSeconds).map(c=>({...c,start:shiftedTime(c.start),end:shiftedTime(c.end)}));console.log('Caption timings are approximate and require listening review.');}
    captions=cues.map((c,i)=>{num(c.start,'caption start');num(c.end,'caption end');if(c.end<=c.start||c.end>target+0.1)throw new Error('Caption cue falls outside the video.');return `${i+1}\n${clock(c.start)} --> ${clock(c.end)}\n${wrapCaption(String(c.text))}\n`;}).join('\n');
  }
  await writeFile(join(work,'captions.srt'),captions);
  const font=existsSync('C:\\Windows\\Fonts\\arial.ttf')?'C:\\Windows\\Fonts\\arial.ttf':existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')?'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf':null;
  const fontEnv={};
  if(font){
    await copyFile(font,join(work,'caption-font.ttf'));
    await mkdir(join(work,'font-cache'),{recursive:true});
    await writeFile(join(work,'fonts.conf'),'<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>.</dir><cachedir>font-cache</cachedir><config></config></fontconfig>');
    fontEnv.FONTCONFIG_FILE=join(work,'fonts.conf');
  }
  const disclosure=manifest.captureKind==='edited-screen-walkthrough'?`Edited screen walkthrough${manifest.preparedTextInput?' | Prepared text input':''} | AI-generated narration`:manifest.editedWaits?'AI-generated narration | Some waiting time shortened':'AI-generated narration';
  const captionStyle=manifest.fullFrame?'FontName=Arial,FontSize=11,BorderStyle=3,Outline=2,BackColour=&H90000000,MarginV=8':'FontName=Arial,FontSize=12,Outline=1,MarginV=10';
  if(manifest.disclosureText!==undefined&&(typeof manifest.disclosureText!=='string'||manifest.disclosureText.length>180))throw new Error('Invalid disclosure text.');
  await writeFile(join(work,'disclosure.txt'),manifest.disclosureText??disclosure);
  let filter=`subtitles=filename=captions.srt:fontsdir=.:force_style='${captionStyle}',drawtext=${font?'fontfile=caption-font.ttf:':''}textfile=disclosure.txt:fontcolor=white:fontsize=18:box=1:boxcolor=black@0.55:x=20:y=16`;
  const overlays=manifest.overlays??[];if(!Array.isArray(overlays)||overlays.length>12)throw new Error('Invalid disclosure overlays.');
  for(let i=0;i<overlays.length;i++){const o=overlays[i];num(o.start,'overlay start');num(o.end,'overlay end');if(o.end<=o.start||o.end>target||typeof o.text!=='string'||o.text.length>160)throw new Error('Invalid overlay.');await writeFile(join(work,`overlay-${i}.txt`),o.text);filter+=`,drawtext=${font?'fontfile=caption-font.ttf:':''}textfile=overlay-${i}.txt:fontcolor=white:fontsize=20:box=1:boxcolor=black@0.7:x=20:y=${44+i*26}:enable='between(t,${o.start},${o.end})'`;}
  if(losslessIntermediate)filter+=',format=rgb24,scale=iw:ih:in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p';
  const colorTags=losslessIntermediate?['-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709']:[];
  await run('ffmpeg',['-hide_banner','-loglevel','error','-i',video,'-i',narration,'-map','0:v:0','-map','1:a:0','-vf',filter,'-af','loudnorm=I=-16:TP=-1.5:LRA=11,apad','-t',String(target),'-c:v','libx264','-preset',finalPreset,'-crf',String(finalCrf),'-pix_fmt','yuv420p',...colorTags,'-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart',output],work,fontEnv);
  const verified=await probe(output);const duration=Number(verified.format.duration);
  if(Math.abs(duration-target)>0.15)throw new Error(`Export duration mismatch: expected ${target}, observed ${duration}.`);
  const videoStream=verified.streams.find(s=>s.codec_type==='video');const audioStream=verified.streams.find(s=>s.codec_type==='audio');
  if(videoStream?.codec_name!=='h264'||audioStream?.codec_name!=='aac')throw new Error('Export codec verification failed.');
  if(Math.abs(Number(videoStream.duration)-target)>0.15||Number(videoStream.nb_frames)<Math.floor(target*29))throw new Error('The video stream does not cover the full requested duration at 30 fps.');
  const captionsOutput=output.replace(/\.mp4$/i,'.srt');await writeFile(captionsOutput,captions,{flag:'wx'});
  const report={output,captions:captionsOutput,durationSeconds:duration,width:videoStream.width,height:videoStream.height,videoCodec:videoStream.codec_name,audioCodec:audioStream.codec_name,intermediateCodec:losslessIntermediate?'Lossless FFV1 RGB (bgr0)':'H264 yuv420p',finalCrf,finalPreset,colorConversion:losslessIntermediate?'One RGB→BT.709 yuv420 conversion at final delivery encoding':null,narrationSeconds:audioSeconds,sourceNarrationSeconds:sourceAudioSeconds,narrationPauses,manifestSha256:createHash('sha256').update(await readFile(manifestPath)).digest('hex'),sourceCrop,provenance,editedWaits:Boolean(manifest.editedWaits)||manifest.captureKind==='edited-screen-walkthrough',preparedTextInput:Boolean(manifest.preparedTextInput),overlays,captionTimings:manifest.script&&!manifest.captions&&!manifest.captionCues&&!manifest.captionCuesFile?'approximate—review required':'provided—review required',reviewStatus:'Technical checks passed; full playback and user review pending',workDirectory:work};
  await writeFile(output.replace(/\.mp4$/i,'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
