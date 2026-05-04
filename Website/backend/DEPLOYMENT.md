# Deployment Guide

## Prerequisites

- Node.js 16+ installed
- RCON access to your Conan Exiles server
- Stripe/PayPal account with API keys
- Email service credentials (Gmail, SendGrid, etc.)
- Domain name with SSL certificate (for production)

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Configure Environment

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` and fill in all required values:
   - RCON credentials (host, port, password)
   - Stripe secret key and webhook secret
   - PayPal client ID and secret
   - Email service credentials
   - Admin API key (generate a strong random key)

## Step 3: Initialize Database

The database will be automatically created on first run. The schema is in `database/schema.sql`.

## Step 4: Configure Payment Webhooks

### Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copy the webhook signing secret to `.env` as `STRIPE_WEBHOOK_SECRET`

### PayPal Webhooks

1. Go to PayPal Developer Dashboard → My Apps & Credentials
2. Select your app → Webhooks
3. Add webhook URL: `https://your-domain.com/api/webhooks/paypal`
4. Select events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`

## Step 5: Update Frontend Configuration

In `HoAWebsite/payment.js`, update:
```javascript
const API_BASE_URL = 'https://your-domain.com'; // Change from localhost
```

In `HoAWebsite/order-tracking.html`, update:
```javascript
window.API_BASE_URL = 'https://your-domain.com';
```

## Step 6: Configure Products

Update product delivery commands in the database. Connect to the database and update the `delivery_commands` field for each product:

```sql
UPDATE products 
SET delivery_commands = '["GiveItemToPlayer {STEAM_ID} BP_Weapon_Sword_01 1"]'
WHERE product_id = 'weapon';
```

Replace `BP_Weapon_Sword_01` with actual item IDs from your server.

## Step 7: Deploy Backend

### Option A: Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start server.js --name hoa-backend
pm2 save
pm2 startup
```

### Option B: Using systemd

Create `/etc/systemd/system/hoa-backend.service`:
```ini
[Unit]
Description=Heart of Acheron Backend
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/backend
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable hoa-backend
sudo systemctl start hoa-backend
```

### Option C: Using Docker

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t hoa-backend .
docker run -d -p 3000:3000 --env-file .env hoa-backend
```

## Step 8: Set Up Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/hoa-backend`:
```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable SSL with Let's Encrypt:
```bash
sudo certbot --nginx -d api.your-domain.com
```

## Step 9: Test the System

1. Test RCON connection:
   ```bash
   curl http://localhost:3000/health
   ```

2. Test payment flow with Stripe test mode
3. Verify webhook delivery in Stripe/PayPal dashboards
4. Check logs: `tail -f logs/combined.log`

## Step 10: Monitor

- Set up log rotation
- Monitor disk space for database
- Set up uptime monitoring (UptimeRobot, etc.)
- Configure email alerts for failed deliveries

## Troubleshooting

### RCON Connection Fails
- Verify RCON is enabled in server config
- Check firewall allows RCON port
- Verify credentials in `.env`

### Webhooks Not Working
- Verify webhook URLs are correct
- Check webhook signatures match
- Review logs in `logs/error.log`

### Delivery Fails
- Check player is online
- Verify Steam ID is correct
- Check RCON commands are valid
- Review delivery logs in database

## Security Checklist

### Before Deployment - Critical

- [ ] Generate strong `JWT_SECRET` (min 32 random characters): `openssl rand -hex 32`
- [ ] Generate strong `ADMIN_API_KEY` (min 32 random characters): `openssl rand -hex 32`
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Configure `ALLOWED_ORIGINS` with your production domain(s)
- [ ] Use production Stripe keys (not test keys)
- [ ] Use production PayPal credentials (not sandbox)
- [ ] Set secure RCON password
- [ ] Enable HTTPS only (SSL/TLS certificate)
- [ ] Configure firewall (only allow necessary ports: 80, 443, RCON port)
- [ ] Set database file permissions to 600: `chmod 600 database/hoa.db`
- [ ] Verify CSRF protection is working
- [ ] Test brute force protection (account lockout)
- [ ] Verify XSS protection (test with malicious input)
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Review security logs regularly

### Post-Deployment

- [ ] Set up automated database backups (encrypted)
- [ ] Configure log rotation
- [ ] Set up uptime monitoring (UptimeRobot, etc.)
- [ ] Configure error monitoring (Sentry, etc.)
- [ ] Monitor security logs for suspicious activity
- [ ] Schedule regular security audits
- [ ] Keep dependencies updated (`npm audit` monthly)
- [ ] Review failed login attempts weekly
- [ ] Monitor for unusual API usage patterns

## Maintenance

- Regularly check logs for errors
- Monitor database size
- Update products as needed
- Review failed deliveries weekly
- Backup database daily

