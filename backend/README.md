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

## Cloudinary for images

Create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the backend `.env`. Keep the API secret private and never commit it. Product, profile, review, and admin moderation images are uploaded through the authenticated backend; JPG, PNG, and WebP files up to 5 MB each are accepted. Product galleries and moderation actions accept up to five product images and four evidence images respectively. Only admins can upload moderation evidence. Restart the backend after configuring these variables.

## OpenAPI documentation

The full OpenAPI 3.0.3 specification is in [`openapi.yaml`](./openapi.yaml). Import it into Swagger Editor or another OpenAPI-compatible tool to browse and try the documented API. When the backend is running, NestJS Swagger UI is also available at `http://localhost:3000/api`.

Authenticated routes use the `access_token` cookie; the refresh endpoint uses the `refresh_token` cookie. The YAML specification describes the registered HTTP routes, including documented aliases and known route/guard limitations.
