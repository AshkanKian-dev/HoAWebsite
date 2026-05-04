# Security Documentation

This document outlines the security measures implemented in the Heart of Acheron website and best practices for maintaining security.

## Security Features

### Authentication & Authorization

- **Password Hashing**: Passwords are hashed using bcrypt with 12 rounds
- **Session Management**: Secure token-based sessions with expiration
- **Brute Force Protection**: Account lockout after 5 failed login attempts (15-minute lockout)
- **Session Security**: 
  - Tokens only accepted from Authorization header or HttpOnly cookies
  - Query string tokens disabled for security
  - Secure cookie flags in production (HttpOnly, Secure, SameSite)

### Input Validation & Sanitization

- **XSS Prevention**: 
  - Server-side HTML sanitization using DOMPurify
  - Client-side HTML escaping for user-generated content
  - Content Security Policy (CSP) headers
- **SQL Injection Prevention**: All queries use parameterized statements
- **Command Injection Prevention**: 
  - Steam ID validation (17 digits only)
  - Character name validation (no dangerous characters)
  - RCON command validation before execution

### Rate Limiting

- **Payment Endpoints**: 10 requests per 15 minutes per IP
- **API Endpoints**: 100 requests per 15 minutes per IP
- **Webhook Endpoints**: 100 requests per minute per IP

### Security Headers

- **Content Security Policy (CSP)**: Restricts resource loading
- **Strict Transport Security (HSTS)**: Forces HTTPS for 1 year
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer Policy**: Controls referrer information
- **Permissions Policy**: Restricts browser features

### CSRF Protection

- CSRF tokens required for all state-changing requests
- Webhook endpoints excluded (use signature verification instead)
- Tokens stored in HttpOnly cookies

### Request Security

- **Body Size Limits**: 1MB limit for JSON and URL-encoded payloads
- **Input Validation**: All inputs validated and sanitized
- **Error Handling**: No stack traces or sensitive info leaked in production

## Security Logging

Security events are logged to `logs/security.log`:

- Failed login attempts
- Successful logins
- Account lockouts/unlocks
- Suspicious activity
- Authentication failures
- Privilege escalation attempts

## Environment Variables Security

### Required Variables

All environment variables must be set before deployment. See `.env.example` for a complete list.

### Critical Secrets

**JWT_SECRET**: Used for session token generation
- Must be at least 32 random characters
- Generate with: `openssl rand -hex 32`
- Never commit to version control

**ADMIN_API_KEY**: Used for admin API access
- Must be at least 32 random characters
- Generate with: `openssl rand -hex 32`
- Never commit to version control

**RCON_PASSWORD**: Server RCON password
- Use a strong, unique password
- Never commit to version control

### Production Checklist

Before deploying to production:

1. ✅ All secrets use strong random values (not defaults)
2. ✅ `NODE_ENV=production` is set
3. ✅ `ALLOWED_ORIGINS` includes only your domain(s)
4. ✅ Production Stripe/PayPal keys are configured
5. ✅ HTTPS is enabled
6. ✅ Database file permissions are restricted (600)
7. ✅ Firewall is configured
8. ✅ Dependencies are up to date (`npm audit`)

## Database Security

- **File Permissions**: Database file should have 600 permissions (owner read/write only)
- **Backups**: Regular encrypted backups recommended
- **Parameterized Queries**: All database queries use prepared statements
- **Input Validation**: All inputs validated before database operations

## API Security

### Authentication

- Bearer tokens in Authorization header
- HttpOnly cookies for additional security
- Session expiration (7 days default, 30 days with "remember me")

### Authorization

- Admin endpoints require `X-API-Key` header
- User-specific endpoints verify session ownership
- Forum posts/topics verify author ownership

## Common Vulnerabilities Prevented

### XSS (Cross-Site Scripting)
- ✅ Server-side HTML sanitization
- ✅ Client-side HTML escaping
- ✅ Content Security Policy headers

### SQL Injection
- ✅ Parameterized queries exclusively
- ✅ Input validation

### CSRF (Cross-Site Request Forgery)
- ✅ CSRF tokens on state-changing requests
- ✅ SameSite cookie attribute

### Command Injection
- ✅ Input validation for RCON commands
- ✅ Whitelist validation for Steam IDs
- ✅ Character name sanitization

### Brute Force Attacks
- ✅ Rate limiting
- ✅ Account lockout after failed attempts
- ✅ Login attempt tracking

### Session Hijacking
- ✅ HttpOnly cookies
- ✅ Secure flag in production
- ✅ Token rotation capability
- ✅ IP address tracking

## Security Best Practices

### For Developers

1. **Never commit secrets**: Use `.env` files (already in `.gitignore`)
2. **Validate all inputs**: Server-side validation is mandatory
3. **Sanitize user content**: Especially forum posts and user-generated content
4. **Use parameterized queries**: Never concatenate user input into SQL
5. **Keep dependencies updated**: Run `npm audit` regularly
6. **Review security logs**: Check `logs/security.log` regularly

### For Administrators

1. **Regular backups**: Encrypted database backups
2. **Monitor logs**: Review security logs weekly
3. **Update dependencies**: Monthly security audits
4. **Review access**: Audit admin API key usage
5. **Monitor failed logins**: Investigate suspicious patterns
6. **Keep server updated**: OS and Node.js security updates

## Incident Response

If a security incident is detected:

1. **Immediately**: Review security logs
2. **Assess**: Determine scope of potential breach
3. **Contain**: Rotate all secrets (JWT_SECRET, ADMIN_API_KEY, etc.)
4. **Notify**: Inform affected users if data was compromised
5. **Document**: Record incident details and response
6. **Prevent**: Update security measures to prevent recurrence

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** create a public issue
2. Contact the administrator directly
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before disclosure

## Security Updates

This application implements security best practices, but security is an ongoing process. Regular updates and audits are essential.

Last updated: 2025-12-10

