# eBay Lagerverwaltung

Eine Web-App zur Verwaltung Ihres eBay-Lagers mit Verkaufs-Analytics.

## Features

- **Lagerverwaltung**: Artikel anlegen, kategorisieren, Lagerorte zuweisen
- **Dashboard**: KPIs, Charts, Umsatz-Trends
- **Authentifizierung**: Sichere Anmeldung mit E-Mail/Passwort

## Tech Stack

- React 18 + TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- TanStack Query
- Supabase

## Setup

### 1. Supabase einrichten

1. Neues Projekt auf [supabase.com](https://supabase.com) erstellen
2. SQL-Migration ausführen:
   - Öffne die Supabase SQL-Konsole
   - Führe `supabase/migrations/001_initial_schema.sql` aus
   - Führe `supabase/migrations/002_rls_policies.sql` aus
3. Storage Buckets erstellen:
   - `item-images` (public)
   - `receipts` (private)
4. Kopiere die API-Keys in `.env.local`

### 2. Umgebungsvariablen

Erstelle `.env.local`:

```env
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key
```

### 3. Entwicklung starten

```bash
npm install
npm run dev
```

### 4. Build für Production

```bash
npm run build
```

## Deployment auf Netlify

1. GitHub-Repo mit Netlify verbinden
2. Build-Command: `npm run build`
3. Publish-Directory: `dist`
4. Umgebungsvariablen setzen:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Ordnerstruktur

```
src/
├── app/              # App-Router und Providers
├── components/
│   ├── ui/          # shadcn/ui Komponenten
│   └── layout/      # App-Layout
├── features/
│   ├── auth/        # Auth-Seiten
│   ├── inventory/   # Lagerverwaltung
│   └── dashboard/   # Dashboard
├── lib/             # Utilities
├── hooks/           # Custom Hooks
└── types/           # TypeScript-Typen
```

## Lizenz

MIT
