# Heart of Acheron — Local Dev Setup

## Project Structure

```
Website/
├── client/              ← Frontend (HTML, CSS, JS)
│   ├── pages/           ← All HTML pages
│   └── assets/
│       ├── css/         ← styles.css
│       ├── js/          ← auth.js, payment.js, forum.js, script.js
│       └── images/      ← Logo, shop item images
├── server/              ← Node.js / Express backend
│   ├── routes/          ← API route handlers
│   ├── services/        ← Business logic (delivery, email, etc.)
│   ├── database/        ← SQLite schema + DB helpers
│   ├── middleware/       ← Auth, rate limiting, sanitization
│   └── server.js        ← Entry point
└── docs/                ← This folder
```

---

## Step 1 — Install Node.js

1. Go to **https://nodejs.org** and download the **LTS** version (v20 or newer)
2. Run the installer — accept all defaults
3. Verify it worked: open a terminal and run:
   ```
   node --version
   npm --version
   ```
   Both should print version numbers.

---

## Step 2 — Configure Environment Variables

1. Open the `server/` folder
2. Copy `.env.example` to a new file called `.env`:
   ```
   copy .env.example .env
   ```
3. Open `.env` and fill in your real values:

   | Variable | Where to get it |
   |----------|----------------|
   | `STEAM_API_KEY` | https://steamcommunity.com/dev/apikey |
   | `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/apikeys |
   | `STRIPE_PUBLISHABLE_KEY` | Same Stripe dashboard |
   | `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → your endpoint |
   | `PAYPAL_CLIENT_ID` | https://developer.paypal.com/dashboard |
   | `PAYPAL_CLIENT_SECRET` | Same PayPal dashboard |
   | `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `SESSION_SECRET` | Same command as above |
   | `ADMIN_API_KEY` | Same command as above |
   | `ADMIN_EMAIL` | Your admin login email |
   | `ADMIN_PASSWORD` | A strong password (min 12 chars) |
   | `EMAIL_USER` | Your Gmail address |
   | `EMAIL_PASS` | Gmail App Password (not your real password) |
   | `RCON_PASSWORD` | From your game server panel |

---

## Step 3 — Install Backend Dependencies

Open a terminal in the `server/` folder and run:

```
npm install
```

This installs everything listed in `package.json` including Express, Stripe, PassportJS, and all other dependencies.

---

## Step 4 — Start the Backend Server

```
npm start
```

You should see:
```
Server running on port 3000
Environment: development
```

Verify it's working:
```
curl http://localhost:3000/health
```
Should return: `{"status":"ok",...}`

To auto-restart when you edit files, use:
```
npm run dev
```
(requires `nodemon` — installed automatically)

---

## Step 5 — View the Frontend

**Option A — Open directly in browser (simplest)**
- Open `client/pages/index.html` by double-clicking it in File Explorer
- Most pages will render; API calls will fail until the backend is running

**Option B — VS Code Live Server (recommended for development)**
1. Install [VS Code](https://code.visualstudio.com/)
2. Install the **Live Server** extension (search in the Extensions panel)
3. Right-click `client/pages/index.html` → **Open with Live Server**
4. Your site will open at `http://127.0.0.1:5500` and auto-refresh on save

---

## Step 6 — External Access (ngrok)

To access your site from another device or share it for testing:

1. Download ngrok from **https://ngrok.com/download**
2. Sign up for a free account and follow their setup instructions
3. In a new terminal, run:
   ```
   ngrok http 3000
   ```
4. ngrok will give you a URL like `https://abc123.ngrok-free.app`
5. Update `STEAM_REALM` and `STEAM_RETURN_URL` in your `.env` to this URL when testing Steam login externally

---

## Webhook Setup (Stripe & PayPal)

For payments to actually complete their delivery, webhooks must be configured:

**Stripe:**
1. Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://yourdomain.com/api/webhooks/stripe` (use ngrok URL for testing)
3. Events to listen for: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
4. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET` in `.env`

**PayPal:**
1. Go to PayPal Developer → My Apps → your app → Webhooks
2. URL: `https://yourdomain.com/api/webhooks/paypal`
3. Events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`

---

## Steam Login Setup

1. Get your Steam API key at **https://steamcommunity.com/dev/apikey**
   - Domain: enter `localhost` for development
2. Add to `.env`:
   ```
   STEAM_API_KEY=your_key_here
   STEAM_REALM=http://localhost:3000
   STEAM_RETURN_URL=http://localhost:3000/api/auth/steam/callback
   ```
3. For production, update both values to your real domain

---

## Security Checklist Before Going Live

- [ ] Change `NODE_ENV` to `production`
- [ ] Generate fresh `JWT_SECRET`, `SESSION_SECRET`, `ADMIN_API_KEY` with openssl
- [ ] Set `ALLOWED_ORIGINS` to your real domain (not localhost)
- [ ] Use production Stripe keys (not `sk_test_*`)
- [ ] Switch PayPal to `PAYPAL_MODE=production`
- [ ] Get an SSL certificate (Let's Encrypt is free) and serve HTTPS only
- [ ] Set file permissions on the database: `chmod 600 database/hoa.db`
- [ ] Never commit `.env` to git (it's already in `.gitignore`)
- [ ] Change the default `ADMIN_PASSWORD` before first launch
