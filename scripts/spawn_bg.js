import { spawn } from 'child_process';

const child = spawn('npx', ['tsx', 'scripts/seed_100_translated_resume.ts'], {
  detached: true,
  stdio: 'ignore'
});

child.unref();
console.log('Background task spawned');
