/**
 * Interest sync utilities (ComNode -> wallet)
 *
 * Account-update polling from AssignNode does not carry per-address interest snapshots.
 * To keep GAS/interest accurate (especially after tx gas deductions), we can periodically
 * refresh canonical interest from ComNode query-address.
 */

import { normalizeInterestFields } from './interestAccrual.js';

/**
 * Apply ComNode query results onto the local wallet address metadata.
 *
 * @param {object} wallet - user.wallet
 * @param {Array<{address:string, interest:number, lastHeight?:number}>} balances - normalized balances
 * @returns {{changed:boolean, updated:number}}
 */
export function applyComNodeInterests(wallet, balances) {
  if (!wallet || typeof wallet !== 'object') return { changed: false, updated: 0 };
  const addrMsg = wallet.addressMsg || wallet.AddressMsg;
  if (!addrMsg || typeof addrMsg !== 'object') return { changed: false, updated: 0 };
  if (!Array.isArray(balances) || balances.length === 0) return { changed: false, updated: 0 };

  let updated = 0;
  let changed = false;

  for (const b of balances) {
    const address = String(b?.address || '').replace(/^0x/i, '').toLowerCase();
    if (!address) continue;
    const meta = addrMsg[address];
    if (!meta || typeof meta !== 'object') continue;

    // ComNode uses `Interest` as canonical current interest.
    const interest = Number(b?.interest);
    if (!Number.isFinite(interest)) continue;

    const prev =
      (typeof meta.EstInterest === 'number' && Number.isFinite(meta.EstInterest) ? meta.EstInterest : null) ??
      (typeof meta.estInterest === 'number' && Number.isFinite(meta.estInterest) ? meta.estInterest : null) ??
      (typeof meta.gas === 'number' && Number.isFinite(meta.gas) ? meta.gas : null);

    meta.EstInterest = interest;
    meta.estInterest = interest;
    meta.gas = interest;

    if (typeof b?.lastHeight === 'number' && Number.isFinite(b.lastHeight)) {
      meta.LastHeight = b.lastHeight;
      meta.lastHeight = b.lastHeight;
    }

    normalizeInterestFields(meta);

    updated++;
    if (prev === null || prev !== interest) changed = true;
  }

  return { changed, updated };
}
