# Meatena Butchery Operations Platform

Monorepo for the Meatena operational platform.

## Apps

- `backend` - NestJS API with PostgreSQL
- `frontend` - Next.js web app
- `mobile-native` - React Native standalone mobile app

## Fresh Server Setup

Backend:

```bash
cd backend
npm install
npm run build
npm run db:init
npm run start:prod
```

Frontend:

```bash
cd frontend
npm install
npm run build
npm run start
```

Use `backend/.env.production.example` and `frontend/.env.production.example` as templates.
