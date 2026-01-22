Joining a guarantor organization is not required, but it unlocks more capabilities and usually provides a smoother experience (cross-chain, pledge, faster updates, etc.). This page explains:
- What an organization is
- When you may want to join
- How to join / leave
- What changes after joining

---

## 1. What Is a “Guarantor Organization”?
Think of an organization as a **coordinated network**:
- nodes in the org help process transactions and updates more efficiently
- after joining, your wallet can use the org path for better speed and reliability

It is not custodial: your private key stays local and you keep full control of your assets.

---

## 2. Do I Need to Join?
You can still use PanguPay without joining:
- create addresses, check balances, send normal transfers

After joining, you typically unlock:
- **Cross-chain transfers** (the “Cross-chain” mode appears on the main page)
- **Pledge mode** (organization workflow)
- **Stronger account update mechanisms** (real-time stream / faster polling)

Recommended for first-time users:
1. complete one small normal transfer first
2. then join an org to try cross-chain

---

## 3. How to Join (Step by Step)
1. Open the “Organization / Guarantor Organization” page (usually from the footer navigation).
2. Pick an organization from the list and open its detail page.
3. Click “Join / Apply”.
4. Confirm signing when prompted (enter payment password if needed).
5. Go back to the main page. You should see:
   - “Normal” becomes “Fast”
   - “Cross-chain / Pledge” modes appear (if supported)

> Tip: joining may take a moment to sync. If the UI doesn’t update immediately, wait a bit or refresh the page.

---

## 4. How to Leave an Organization
To return to “normal user” mode:
1. open the organization page
2. click “Leave”
3. back on the main page, only the normal transfer flow remains available

---

## 5. What You’ll Notice After Joining
- More transfer modes become available: Fast / Cross-chain / Pledge.
- Status updates feel quicker and smoother.
- Address verification becomes more reliable (autofill works better).

---

## 6. Common Issues

### 6.1 “Join” fails or does nothing
Check in order:
- is the backend Gateway running? (local default is `http://localhost:3001`)
- is your network available?
- do you need to enter a payment password (encrypted key prompts)?
- refresh and try again

### 6.2 Cross-chain mode still doesn’t show up
Possible reasons:
- sync is still in progress (wait a bit and refresh)
- the selected organization does not support cross-chain
- you are not actually in “joined” state (confirm in organization page)

If you’re unsure, follow the “Troubleshooting” checklist.
