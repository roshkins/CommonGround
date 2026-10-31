import { readConfig } from '../lib/config.mjs';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd(), c = readConfig(root);
if (!c.twilioSid || !c.twilioToken) throw new Error('Twilio account credentials are missing.');
const authorization = `Basic ${Buffer.from(`${c.twilioSid}:${c.twilioToken}`).toString('base64')}`;
async function get(url) { const response = await fetch(url, { headers: { Authorization: authorization }, signal: AbortSignal.timeout(20000) }); if (!response.ok) throw new Error(`Twilio returned HTTP ${response.status}; check credentials and permissions locally.`); return response.json(); }
const action = process.argv[2] || 'list';
if (action === 'list') {
  const pricing = await get('https://pricing.twilio.com/v1/PhoneNumbers/Countries/US');
  const available = await get(`https://api.twilio.com/2010-04-01/Accounts/${c.twilioSid}/AvailablePhoneNumbers/US/Local.json?AreaCode=415&VoiceEnabled=true&PageSize=3`);
  const result = { currency: pricing.price_unit, prices: pricing.phone_number_prices, candidates: available.available_phone_numbers.map(p => ({ phoneNumber: p.phone_number, friendlyName: p.friendly_name, region: p.region, locality: p.locality, capabilities: p.capabilities })) };
  mkdirSync(join(root, 'data'), { recursive: true }); writeFileSync(join(root, 'data', 'phone-candidates.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} else if (action === 'route') {
  const statePath = join(root, 'data', 'freestyle-deployment.json');
  const deployment = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
  const origin = c.publicOrigin || (deployment.domain ? `https://${deployment.domain}` : '');
  if (!c.phoneNumber || !origin) throw new Error('Set TWILIO_PHONE_NUMBER and deployed PUBLIC_ORIGIN first.');
  const numbers = await get(`https://api.twilio.com/2010-04-01/Accounts/${c.twilioSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(c.phoneNumber)}`);
  const existing = numbers.incoming_phone_numbers.find(n => n.phone_number === c.phoneNumber);
  if (!existing) throw new Error('The configured number is not owned by this Twilio account.');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.twilioSid}/IncomingPhoneNumbers/${existing.sid}.json`, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ VoiceUrl: `${origin}/phone/incoming`, VoiceMethod: 'POST' }) });
  if (!response.ok) throw new Error(`Twilio routing update returned HTTP ${response.status}.`);
  console.log(JSON.stringify({ phoneNumber: c.phoneNumber, voiceUrl: `${origin}/phone/incoming`, configured: true }));
} else throw new Error('Unknown action.');
