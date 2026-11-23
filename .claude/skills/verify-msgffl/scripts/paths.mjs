import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Everything this skill writes lives here, outside the repo: the Sleeper cache, run state, evidence. */
export const home = () => process.env.VERIFY_MSGFFL_HOME || join(homedir(), '.cache', 'verify-msgffl');
export const repoRoot = () => join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const runDir = (id) => join(home(), 'runs', id);
