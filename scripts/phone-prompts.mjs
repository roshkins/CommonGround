import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../lib/config.mjs';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = readConfig(root);
const prompts = {
  'language-menu': 'English, press one. 粵語，請按二。 Shqip, shtypni tre. Auto, press zero.',
  'sq-code': 'Shkruani kodin me gjashtë shifra që shfaqet në hapësirën tuaj private.',
  'sq-connected': 'Kodi u pranua. Po lidh avokatin tuaj.',
};
await mkdir(join(root, 'public', 'phone-prompts'), { recursive: true });
await Promise.all(Object.entries(prompts).map(async ([name, input]) => {
  const path = join(root, 'public', 'phone-prompts', `${name}.mp3`);
  try { await access(path); console.log(`${name}: existing asset retained`); return; } catch {}
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', signal: AbortSignal.timeout(45000),
    headers: { Authorization: `Bearer ${config.openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'marin', input, response_format: 'mp3',
      instructions: 'Read the supplied phone instructions exactly, clearly and at a calm practical pace. Preserve each language and number. Use natural Cantonese for 粵語, not Mandarin; natural Albanian for Shqip. Do not translate or add text.' }),
  });
  if (!response.ok) throw new Error(`Phone prompt ${name} failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path, bytes, { flag: 'wx' });
  console.log(JSON.stringify({ asset: name, bytes: bytes.length }));
}));
