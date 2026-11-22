import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { spawn } from 'node:child_process';

if (existsSync('.env')) loadEnvFile('.env');
const env = { ...process.env };
if (!env.FIREBASE_PROJECT_ID) {
  Object.assign(env, {
    FIREBASE_PROJECT_ID: 'demo-reclass', FIREBASE_STORAGE_BUCKET: 'demo-reclass.appspot.com', FIREBASE_WEB_API_KEY: 'demo-key',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199'
  });
}
const child = spawn(process.execPath, ['server/index.js'], { env, stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code ?? 1; });
