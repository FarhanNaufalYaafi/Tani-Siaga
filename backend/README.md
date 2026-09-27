# Template Auth

This folder contains the authentication-related logic extracted from a larger project.

To use:

1. Copy files into your NestJS project or run `npm install` here and configure `.env`.
2. See `.env.example` for required environment variables.

## SMTP for verification codes

Configure these variables in the backend `.env` before using signup verification, password reset, or password changes:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=Tani Siaga <no-reply@example.com>
```

Use the SMTP provider's app password or API credential where required. Never commit real SMTP credentials. Verification codes expire after 10 minutes and can only be used for the email and action they were issued for.
