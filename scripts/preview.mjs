import { createApp } from '../server.mjs';
import { readConfig } from '../lib/config.mjs';
const config = () => ({ ...readConfig(process.cwd()), port: Number(process.env.PREVIEW_PORT || 3088), host: '127.0.0.1', publicOrigin: '' });
const app = createApp({ config });
app.server.listen(config().port, config().host, () => console.log(`CommonGround integration preview: http://127.0.0.1:${app.server.address().port}`));
process.on('SIGINT', () => app.server.close());
process.on('SIGTERM', () => app.server.close());
