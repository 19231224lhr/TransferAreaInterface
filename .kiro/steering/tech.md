# Technology Stack

## Backend

- **Language**: Go 1.23+
- **Module**: `TransferAreaInterface`
- **Cryptography**: ECDSA P-256 (secp256r1) elliptic curve
- **Serialization**: JSON for struct serialization and hashing

## Frontend

- **Framework**: Vanilla HTML/CSS/JavaScript (no framework)
- **Crypto API**: WebCrypto API for client-side key generation
- **Storage**: localStorage for account persistence
- **Design**: Glassmorphism style with CSS gradients and backdrop-filter
- **Internationalization**: Built-in i18n system supporting Chinese (zh-CN) and English (en)

## Web Server

- Built-in Go HTTP server serving static files and API endpoints
- Default port: 8081

## Common Commands

### Start Development Server

```bash
go run ./backend/cmd/webserver/main.go
```

Access at: http://localhost:8081/

### Run Go Tests (if any)

```bash
go test ./...
```

### Build Backend

```bash
go build ./backend/cmd/webserver
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/account/new` | POST | Create new account with keypair |
| `/api/keys/from-priv` | POST | Derive account from private key |

## Key Libraries/Dependencies

- Standard Go crypto packages (`crypto/ecdsa`, `crypto/elliptic`, `crypto/sha256`)
- No external Go dependencies (pure stdlib)
- No npm/node dependencies for frontend

## Internationalization (i18n)

### Supported Languages

- **Chinese (Simplified)**: `zh-CN` (default)
- **English**: `en`

### Implementation

- **Storage Key**: `appLanguage` in localStorage
- **Translation Function**: `t(key, params)` for dynamic text
- **HTML Attributes**: 
  - `data-i18n` for text content
  - `data-i18n-placeholder` for input placeholders
  - `data-i18n-title` for tooltips and titles
- **Auto-update**: `updatePageTranslations()` called on route changes
- **Language Selector**: Available in Profile page with flag emojis (🇨🇳/🇺🇸)

### Key Functions

| Function | Purpose |
|----------|---------|
| `t(key, params)` | Get translated text with optional parameter substitution |
| `setLanguage(lang)` | Change current language and update UI |
| `getCurrentLanguage()` | Get current language code |
| `updatePageTranslations()` | Update all elements with i18n attributes |

### Translation Keys Structure

- `common.*` - Common UI elements (buttons, labels)
- `header.*` - Header and navigation
- `welcome.*` - Welcome/landing page
- `wallet.*` - Wallet management
- `transfer.*` - Transaction forms
- `modal.*` - Modal dialogs
- `toast.*` - Toast notifications
- `profile.*` - User profile settings

## Environment Variables

- `PORT`: Server port (default: 8081)
