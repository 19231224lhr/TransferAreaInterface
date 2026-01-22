This page is for **developers / QA**. It helps you run the frontend + backend locally and quickly locate integration issues.

---

## 1. Repo Layout (What You’re Running)
This project usually has two parts:
- Frontend: `TransferAreaInterface` (Vite + TypeScript, default port 3000)
- Backend: `UTXO-Area` (Go, provides HTTP Gateway, default port 3001)

Frontend default Gateway:
- `http://localhost:3001`  
Configured in: `TransferAreaInterface/js/config/api.ts` (can be overridden via `assets/runtime-config.js` using `window.__API_BASE_URL__`)

---

## 2. Requirements
Recommended versions:
- Node.js 18+ (frontend)
- Go 1.22+ (backend)
- On Windows, PowerShell scripts (`.ps1`) are provided

---

## 3. Start the Backend (UTXO-Area)

### 3.1 Recommended: start nodes via scripts
Backend scripts live in: `UTXO-Area/scripts/`  
Common scripts:
- `bootNode.ps1`
- `comNode.ps1`
- `guarNode.ps1`
- `assignNode.ps1`
- `aggrNode.ps1`

A typical startup sequence (example):
1. BootNode (onboarding / service discovery)
2. ComNode (public queries, retail transfers, etc.)
3. Org nodes (Guar/Assign/Aggr) for org mode and cross-chain

> What you need depends on your test goal:  
> - Normal transfers: at least ComNode + Gateway must work  
> - Cross-chain / pledge: org nodes must be up and registered

### 3.2 How to confirm the Gateway is reachable
Frontend depends on the HTTP Gateway. Quick checks:
- open `http://localhost:3001/health` in your browser
- or request it via curl/PowerShell (any OK/JSON response is fine)

If `/health` fails:
- confirm backend processes are running
- check port conflicts / firewall
- review backend logs (it usually prints the listening port)

---

## 4. Start the Frontend (TransferAreaInterface)
Run inside the frontend directory:

```bash
cd TransferAreaInterface
npm install
npm run dev
```

Then open:
- `http://localhost:3000`

---

## 5. Integration Smoke Checklist (In Order)
1. Frontend loads without a blank screen
2. “Refresh balance” on main page produces no API errors (Network has no 4xx/5xx)
3. Organization page can fetch group list (`/api/v1/groups`)
4. Verify (shield) returns address info (`/api/v1/com/query-address-group`)
5. Build transaction can reach signing/submission (retail users submit via ComNode; org users via AssignNode)

---

## 6. Fast Debug Paths

### 6.1 Where does the frontend send requests?
Default base URL in `TransferAreaInterface/js/config/api.ts`:
- `API_BASE_URL = http://localhost:3001` (dev mode)

If you need to point to a different backend temporarily:
- prefer editing `TransferAreaInterface/assets/runtime-config.js`: `window.__API_BASE_URL__ = "http://<HOST>:3001"`
- or inject `window.__API_BASE_URL__` before the app loads

### 6.2 Frontend logs
Browser DevTools:
- Console: stack traces, validation reasons
- Network: API responses and payload formats

### 6.3 Backend logs
Backend logs typically include:
- node startup info (port, PeerID, role)
- Gateway routing and request logs
- transaction receive/processing logs

For deeper reference:
- Frontend docs: `TransferAreaInterface/docs/README.md`, `TransferAreaInterface/docs/04-api-integration.md`
- Backend docs: `UTXO-Area/docs/README.md`

---

## 7. Practical Advice (Saves Time)
- Use a fixed set of test accounts/addresses to avoid “environment drift”.
- When reporting a bug, copy Console + Network info—text beats screenshots.
- For “first click doesn’t work” issues, it’s often async state sync. Refresh, reproduce, and record the exact steps.
