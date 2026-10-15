/**
 * Betting board → Netlify Blobs. All the logic lives in netlify/lib/betsHandler.ts;
 * this file only wires the real store and Sleeper. No env vars needed.
 */
import { makeBetsHandler } from '../lib/betsHandler';
import { blobsBetStore } from '../lib/betStore';
import { sleeperFacts } from '../lib/betFacts';

export default makeBetsHandler({ store: blobsBetStore, facts: sleeperFacts });
