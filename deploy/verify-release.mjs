import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verifyRelease(body, expectedSha) {
  if (!/^[a-f0-9]{40}$/.test(expectedSha)) throw new Error('Invalid expected release SHA');
  let release;
  try { release = JSON.parse(body); } catch { throw new Error('Public origin did not return a release manifest'); }
  if (release?.sha !== expectedSha) throw new Error('Public origin is serving a different release');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    verifyRelease(readFileSync(0, 'utf8'), process.argv[2]);
    console.log('  public origin matches the deployed release');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
