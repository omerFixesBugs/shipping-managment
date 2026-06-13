# LogiFlow — Logistics & Procurement MVP

Three-hub logistics platform (Dubai, China, Bangladesh) built with React + Supabase.

## Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, TanStack Query
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **Notifications:** In-app (Realtime) + Twilio SMS

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations:
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```
3. Deploy Edge Functions:
   ```bash
   npx supabase functions deploy shipment-status
   npx supabase functions deploy notify-sms
   ```
4. Set Edge Function secrets:
   ```bash
   npx supabase secrets set TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx TWILIO_PHONE_NUMBER=+1xxx
   ```

### 2. Frontend

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

### 3. Create users

Create users in Supabase Auth, then assign roles:

```sql
UPDATE profiles SET role = 'owner', full_name = 'Business Owner', phone = '+971500000001' WHERE id = '<uuid>';
UPDATE profiles SET role = 'warehouse_manager', hub = 'dubai', full_name = 'Dubai Manager' WHERE id = '<uuid>';
UPDATE profiles SET role = 'warehouse_manager', hub = 'china', full_name = 'China Manager' WHERE id = '<uuid>';
UPDATE profiles SET role = 'warehouse_manager', hub = 'bangladesh', full_name = 'BD Manager' WHERE id = '<uuid>';
UPDATE profiles SET role = 'client', client_id = '<client-uuid>', full_name = 'Client Name' WHERE id = '<uuid>';
```

## Roles

| Role | Access |
|------|--------|
| Owner | Full dashboard, procurement, finance, all hubs |
| Warehouse Manager | Hub-scoped procurement and shipments |
| Client | Read-only shipment tracking |

## Project structure

```
src/pages/owner/     — Owner portal
src/pages/warehouse/ — Warehouse manager views
src/pages/client/    — Client portal
supabase/migrations/ — Database schema + RLS
supabase/functions/  — Edge Functions (status handoffs, SMS)
```
