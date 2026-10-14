/**
 * Betting board → Netlify Blobs. All the logic lives in netlify/lib/betsHandler.ts;
 * this file only wires the real store and Sleeper. BETS_PIN (the shared league
 * PIN that gates writes) is set in the Netlify UI — never in code.
 */
import { makeBetsHandler } from '../lib/betsHandler';
import { blobsBetStore } from '../lib/betStore';
import { sleeperFacts } from '../lib/betFacts';

export default makeBetsHandler({ store: blobsBetStore, facts: sleeperFacts });
