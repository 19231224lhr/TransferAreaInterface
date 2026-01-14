# Cookie Policy

**Effective date: 2026-01-14**

This policy explains what cookies PanguPay may use and the storage alternatives we rely on more often (such as LocalStorage/SessionStorage). We’ll keep it clear: what is stored, why, and how you can manage it.

---

## 1. What is a Cookie?
A cookie is a small piece of data stored by your browser. Websites can use it to remember preferences or session state.

---

## 2. Does PanguPay always use cookies?
In the current design, PanguPay more commonly uses:
- **LocalStorage / SessionStorage** (language, theme, drafts, last opened docs, etc.)
- **Service Worker cache** (if enabled, to improve load performance)

We generally do not rely on third‑party advertising cookies. However, some deployments may add authentication, reverse proxies, or monitoring components that set essential cookies for session/security.

---

## 3. Storage types we may use or depend on

### 3.1 Essential storage
Used to keep the app usable and convenient, for example:
- language preference (Chinese/English)
- theme preference (light/dark)
- transfer drafts (so refresh doesn’t wipe your input)
- docs reading continuity (so you can continue where you left off)

### 3.2 Performance / caching
Used to reduce repeated downloads and make the app load faster:
- static asset caching (depends on browser and deployment)

### 3.3 Analytics / ads
PanguPay is not ad-driven. If your deployment integrates third-party analytics, please refer to the operator’s notice.

---

## 4. How to manage cookies and local storage
You can use your browser settings to:
- disable or clear cookies
- clear site data (including LocalStorage/SessionStorage)

Note: clearing site data may require:
- re-importing your private key / re-unlocking (if you stored an encrypted key locally)
- re-setting language and theme preferences
- re-entering transfer drafts

---

## 5. Updates
We may update this policy. The latest version will be available in the docs page with a new effective date.

