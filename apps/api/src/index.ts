import 'dotenv/config';
import { createApp } from './app.js';
import { readEnv } from './config/env.js';

const config = readEnv();
const server = createApp(config).listen(config.port, config.host, () => {
  console.info(`BAYANIHAN API listening at http://${config.host}:${config.port}`);
});
server.on('error', () => {
  console.error('API could not listen. Check HOST, PORT and whether the port is already in use.');
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { server.close(); });
}
