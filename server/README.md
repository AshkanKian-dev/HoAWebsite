# Heart of Acheron Backend

Automated package delivery system for Conan Exiles server.

## Features

- Automated package delivery via RCON
- Payment processing (Stripe & PayPal)
- Order tracking and management
- Email notifications
- Admin dashboard
- Retry mechanism for failed deliveries

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your configuration:

```bash
cp .env.example .env
```

Required configuration:
- RCON credentials (host, port, password)
- Stripe/PayPal API keys
- Email service credentials
- Admin API key

### 3. Initialize Database

The database will be automatically created on first run using the schema in `database/schema.sql`.

### 4. Start Server

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## API Endpoints

### Webhooks

- `POST /api/webhooks/stripe` - Stripe webhook handler
- `POST /api/webhooks/paypal` - PayPal webhook handler

### Orders

- `GET /api/orders/:orderId` - Get order by ID
- `GET /api/orders/email/:email` - Get orders by email
- `POST /api/orders/:orderId/retry` - Retry failed order (admin)
- `GET /api/orders/admin/pending` - Get pending deliveries (admin)

### Admin

- `GET /api/admin/stats` - Get statistics (requires X-API-Key header)

## RCON Commands

The system uses the following Conan Exiles admin commands:

- `GiveItemToPlayer <SteamID> <ItemID> <Quantity>` - Give items
- `AddExperience <SteamID> <Amount>` - Add experience
- `SetPlayerLevel <SteamID> <Level>` - Set player level
- `ShowPlayers` - List online players

## Product Configuration

Products are stored in the database with delivery commands in JSON format:

```json
{
  "delivery_commands": [
    "GiveItemToPlayer {STEAM_ID} BP_Weapon_Sword_01 1",
    "GiveItemToPlayer {STEAM_ID} BP_Resource_Iron 1000"
  ]
}
```

Placeholders:
- `{STEAM_ID}` - Replaced with player's Steam ID
- `{CHARACTER_NAME}` - Replaced with character name

## Security

- All webhook endpoints verify signatures
- Rate limiting on all endpoints
- Admin endpoints require API key
- Input validation and sanitization

## Monitoring

- Logs are stored in `logs/` directory
- `combined.log` - All logs
- `error.log` - Error logs only

## Troubleshooting

### RCON Connection Issues

1. Verify RCON is enabled on your server
2. Check firewall allows connections on RCON port
3. Verify credentials in `.env`

### Delivery Failures

1. Check logs in `logs/error.log`
2. Verify player is online or Steam ID is correct
3. Check RCON commands are valid for your server version

### Payment Issues

1. Verify webhook URLs are configured correctly
2. Check webhook signatures match
3. Review payment provider logs

## License

ISC

