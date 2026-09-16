# Room Booker - meeting-room scheduling application

## Prerequisites

- Node.js 22.6 or newer (required for Node test runner type stripping)
- npm
- PostgreSQL 14 or newer

## Local setup

1. Clone the repository and install the locked dependencies:

```
npm ci
```

2. Create a PostgreSQL database:

```
createdb room_booker
```

3. Copy the example environment file:

```
cp .env.example .env.local
openssl rand -base64 32
```

   Set DATABASE_URL to the database created above and put the generated value
   in SESSION_SECRET. The secret must contain at least 32 characters.
   `DATABASE_SSL=false` is appropriate for a default local PostgreSQL server.
   Keep APP_URL equal to the exact public origin used to access the
   application in production.

4. Apply all pending migrations and load the development seed:

```
npm run db:setup
```

5. Start the application:

```
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are
redirected to the sign-in screen.

## Environment variables

.env.example is the complete configuration template:

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | PostgreSQL connection used by the app and database scripts |
| DATABASE_SSL | Set to true when the PostgreSQL provider requires TLS |
| SESSION_SECRET | HMAC secret for opaque session tokens; minimum 32 characters |
| SESSION_TTL_DAYS | Session lifetime from 1 through 30 days |
| APP_URL | Canonical production origin used by same-origin checks |
| OFFICE_TIME_ZONE | Office IANA timezone; the required value is Europe/Kyiv |
| OFFICE_OPEN_HOUR | Office opening hour; the required value is 9 |
| OFFICE_CLOSE_HOUR | Office closing hour; the required value is 19 |
| EMAIL_CONFIRMATION_REQUIRED | When true, new accounts must use the development confirmation link printed by the server |
| NOTIFY_BEFORE_MINUTES | Lead time from 1 through 60 minutes for end-of-booking notifications |

## Database commands

```
npm run db:migrate
npm run db:seed
npm run db:setup
```

Migrations are applied in filename order and recorded in
schema_migrations. Re-running the migration command skips files that were
already applied.

The seed is for local development. It is repeatable: it upserts six rooms and
two development-only users, then upserts 15 demo bookings by stable
identifiers. Demo dates are recalculated relative to the seed date, keeping
past and upcoming examples useful without creating duplicate rows.

To verify setup from a clean database, drop and recreate the local database,
copy .env.example to .env.local, set a fresh SESSION_SECRET, and follow
only the Local setup steps. Do not run the seed against a production database.

## Development users

These accounts are for local development only. Running the seed restores the
documented display names and password hashes.

| Name | Email | Password |
| --- | --- | --- |
| Paul Johnson | paul@room-booker.local | RoomBooker123! |
| Mark Young | mark@room-booker.local | KyivOffice123! |

## Docker Compose

With Docker Engine or Docker Desktop running, the complete application and
PostgreSQL stack starts with one command:

```
docker compose up --build
```

The database health check gates application startup. The application container
applies migrations, runs the repeatable development seed, and then starts
Next.js at [http://localhost:3000](http://localhost:3000). The PostgreSQL data
is stored in the named room-booker-postgres volume. The credentials and
session secret in docker-compose.yaml are intentionally local-only and must
not be copied into a production deployment.

## Time and interval model

bookings.start_at and bookings.end_at use PostgreSQL timestamptz, so
the application stores absolute instants rather than ambiguous wall-clock
labels. A form value in the browser's validated IANA timezone is converted to
UTC before persistence. The same UTC instant is converted back to the viewer's
timezone for display. Office rules are a separate boundary: start/end slot
alignment and the 09:00–19:00 window are always evaluated in Europe/Kyiv,
even when the viewer is elsewhere.

Intervals are half-open: [start, end). Two intervals overlap only when
newStart < existingEnd && newEnd > existingStart. This lets a booking ending
at 10:00 and another starting at 10:00 coexist while still rejecting partial
overlaps and exact matches.

The schema enforces positive room capacity, trimmed booking titles, valid
foreign keys, and start_at < end_at. The server performs a friendly conflict
check first, while PostgreSQL is the final concurrency authority. Its GiST
exclusion constraint combines room_id with a half-open tstzrange, so two
simultaneous overlapping inserts cannot both commit. The API converts the
database exclusion error into the same clear occupied-slot response.

## Responsive view modes

The calendar supports "Week" and "Day" views. On desktop screens, it defaults to the full week grid. On mobile screens (<640px width), the grid automatically defaults to the single Day view for optimal touch readability and interaction.

## Notifications

Authenticated clients poll `POST /api/notifications` periodically (every 30 seconds while the page is visible) to check for bookings ending within the configured `NOTIFY_BEFORE_MINUTES` window. When a booking ends soon, a toast notification alerts the user and displays the title of the next incoming reservation if one starts immediately afterwards. Users can dismiss the alert via `PATCH /api/notifications/:id`.

## Tests and release checks

```
npm test
npm run lint
npm run typecheck
npm run build
```

npm test runs the focused unit suite with Node's test runner. It covers
half-open overlap cases, email normalization, safe session-derived identity,
ownership checks, booking duration and office-time boundaries, UTC conversion,
daylight-saving day ranges, and weekly recurrence limits.

The API integration suite uses the seeded users and a running application. It
creates a future booking, verifies overlap rejection and cross-user
cancellation protection, then cancels the booking during cleanup:

```
npm run dev
```

In another terminal:
```
npm run test:integration
```

Set ROOM_BOOKER_BASE_URL when the application is not running at
http://localhost:3000.

Run the complete release sequence with:

```
npm run check
```

## Production

After configuring production environment variables and applying migrations:

```
npm ci
npm run db:migrate
npm run build
npm start
```

The production server listens on port 3000 by default. Use the same origin in
APP_URL that employees use through the reverse proxy or hosting platform.
Set DATABASE_SSL=true only when required by the PostgreSQL provider.