PanguPay is designed with security-first principles: your private key is used locally, and signing happens on your device. Still, real security is a partnership—there are a few simple things you can do to reduce risk dramatically.

---

## 1. There Are Only Two Things You Must Protect
### 1) Your Private Key (Most Important)
- Your private key is the “master key” to your funds.
- **Anyone who gets your private key can move your assets.**

### 2) Your Payment Password (The lock for that key)
- The payment password decrypts your key locally so the app can sign.
- **If you forget it, it cannot be recovered** (there is no centralized custody).

---

## 2. Where Is My Private Key? Is It Uploaded?
It is not uploaded.
- The private key is stored on your local device/browser.
- When signing, it is used briefly in memory for that action.

> This is why you must import your private key again when switching browsers/devices—the server never had it.

---

## 3. Back Up Now (Seriously)
We strongly recommend at least one offline backup. Common safe options:
- write it down on paper and store it securely
- keep it on an offline USB drive (not shared, not synced)
- store it in a trusted password manager (with a strong master password / 2FA)

Avoid:
- screenshots in your photo gallery
- sending it via chat apps
- uploading it to cloud drives or online notes

---

## 4. A Payment Password That’s Secure and Memorable
Suggestions:
- at least 8 characters (longer is better)
- mix letters and numbers (or use a long passphrase)
- do not reuse common website passwords

If you fear forgetting it:
- store it in a password manager (recommended)
- or write it down and keep it separate from your private key

---

## 5. When You See “Enter Password”, What’s Happening?
Actions like “Build Transaction / Submit” require signing:
- if your private key is encrypted, you’ll see a password prompt
- correct password → decrypt locally → sign → submit

You may also see a message like “Using cached authorization”:
- it means the app temporarily cached your recent authorization to improve UX
- you can always clear it by logging out/locking the screen

---

## 6. Moving to a New Device/Browser
Simple steps:
1. make sure you still have your private key backup
2. open PanguPay on the new device and choose “Import”
3. paste the private key and set the payment password

> If you only remember the password but lost the private key backup: migration is not possible. The private key is the root credential.

---

## 7. Everyday Safety Habits
- Use PanguPay only on devices you trust.
- Avoid public computers for login or key storage.
- In local testing, don’t use real-value private keys—use dedicated test accounts.
- If anything feels off, pause before confirming and follow the “Troubleshooting” checklist.

Security shouldn’t make you anxious—it should help you feel calm and in control. If you keep your private key backed up and your password protected, most risks are already blocked at the door.
