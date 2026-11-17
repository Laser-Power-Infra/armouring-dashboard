# Armouring 5 Dashboard

Morning-meeting dashboard for Armouring No-5 (Kharagpur). The full spec is in [documentation.md](documentation.md).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm test
```

Google OAuth: add `http://localhost:3000/api/auth/callback/google` as an authorised redirect URI. Only verified `ALLOWED_GOOGLE_DOMAIN` accounts can sign in.

Database (Prisma + Neon) is not set up yet.
