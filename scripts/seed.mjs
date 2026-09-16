import bcrypt from "bcryptjs";
import { getOfficeConfiguration } from "../lib/office.mjs";
import { createDatabasePool } from "./database.mjs";

const pool = createDatabasePool();

const TEST_USERS = [
  {
    displayName: "Paul Johnson",
    email: "paul@room-booker.local",
    password: "RoomBooker123!",
  },
  {
    displayName: "Mark Young",
    email: "mark@room-booker.local",
    password: "KyivOffice123!",
  },
];

const ROOMS = [
  { name: "Aqua", floor: 1, capacity: 4 },
  { name: "Mars", floor: 2, capacity: 6 },
  { name: "Luna", floor: 3, capacity: 8 },
  { name: "Horizon", floor: 4, capacity: 10 },
  { name: "Lotus", floor: 5, capacity: 12 },
  { name: "Space", floor: 2, capacity: 16 },
];

// Stable IDs let repeated seeds move demo dates without duplicating bookings.
const DEMO_BOOKINGS = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    room: "Aqua",
    author: "paul@room-booker.local",
    title: "Design sync",
    color: "blue",
    dayOffset: -3,
    startTime: "10:00",
    endTime: "11:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    room: "Mars",
    author: "mark@room-booker.local",
    title: "Hiring retrospective",
    color: "rose",
    dayOffset: -1,
    startTime: "15:00",
    endTime: "16:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    room: "Luna",
    author: "mark@room-booker.local",
    title: "Quarterly planning",
    color: "violet",
    dayOffset: -1,
    startTime: "10:30",
    endTime: "12:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    room: "Aqua",
    author: "paul@room-booker.local",
    title: "Product stand-up",
    color: "sage",
    dayOffset: 1,
    startTime: "09:30",
    endTime: "10:30",
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    room: "Mars",
    author: "mark@room-booker.local",
    title: "Roadmap review",
    color: "amber",
    dayOffset: 2,
    startTime: "13:00",
    endTime: "14:30",
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    room: "Aqua",
    author: "paul@room-booker.local",
    title: "Customer research",
    color: "slate",
    dayOffset: 3,
    startTime: "16:00",
    endTime: "17:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    room: "Aqua",
    author: "mark@room-booker.local",
    title: "Daily planning",
    color: "blue",
    dayOffset: 2,
    startTime: "09:00",
    endTime: "10:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    room: "Aqua",
    author: "mark@room-booker.local",
    title: "Design sync",
    color: "violet",
    dayOffset: 2,
    startTime: "10:30",
    endTime: "11:30",
  },
  {
    id: "10000000-0000-4000-8000-000000000009",
    room: "Aqua",
    author: "paul@room-booker.local",
    title: "Hiring retrospective",
    color: "rose",
    dayOffset: 1,
    startTime: "15:00",
    endTime: "16:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000010",
    room: "Aqua",
    author: "mark@room-booker.local",
    title: "Quarterly planning",
    color: "amber",
    dayOffset: 2,
    startTime: "12:00",
    endTime: "13:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000011",
    room: "Aqua",
    author: "paul@room-booker.local",
    title: "Product stand-up",
    color: "sage",
    dayOffset: 4,
    startTime: "13:30",
    endTime: "14:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000012",
    room: "Aqua",
    author: "paul@room-booker.local",
    title: "New feature review",
    color: "slate",
    dayOffset: 2,
    startTime: "11:30",
    endTime: "12:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000013",
    room: "Aqua",
    author: "paul@room-booker.local",
    title: "Onboarding session",
    color: "blue",
    dayOffset: -2,
    startTime: "13:30",
    endTime: "14:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000014",
    room: "Aqua",
    author: "paul@room-booker.local",
    title: "Team retrospective",
    color: "violet",
    dayOffset: -6,
    startTime: "13:00",
    endTime: "15:00",
  },
  {
    id: "10000000-0000-4000-8000-000000000015",
    room: "Aqua",
    author: "paul@room-booker.local",
    title: "Team retrospective",
    color: "sage",
    dayOffset: -4,
    startTime: "10:30",
    endTime: "12:30",
  },
];

async function seed() {
  const { timeZone } = getOfficeConfiguration();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Seed credentials use the same bcrypt cost as employee registration.
    const passwordHashes = await Promise.all(
      TEST_USERS.map((user) => bcrypt.hash(user.password, 12)),
    );
    const userIds = new Map();

    for (const [index, user] of TEST_USERS.entries()) {
      // Seeded accounts are confirmed by default.
      const result = await client.query(
        `
          INSERT INTO users (display_name, email, password_hash, email_confirmed_at)
          VALUES ($1, $2, $3, now())
          ON CONFLICT (email) DO UPDATE
          SET
            display_name = EXCLUDED.display_name,
            password_hash = EXCLUDED.password_hash,
            email_confirmed_at = COALESCE(users.email_confirmed_at, now()),
            updated_at = now()
          RETURNING id
        `,
        [user.displayName.trim(), user.email.trim().toLowerCase(), passwordHashes[index]],
      );
      userIds.set(user.email, result.rows[0].id);
    }

    const roomIds = new Map();
    for (const room of ROOMS) {
      const result = await client.query(
        `
          INSERT INTO rooms (name, floor, capacity)
          VALUES ($1, $2, $3)
          ON CONFLICT (name) DO UPDATE
          SET
            floor = EXCLUDED.floor,
            capacity = EXCLUDED.capacity,
            updated_at = now()
          RETURNING id
        `,
        [room.name, room.floor, room.capacity],
      );
      roomIds.set(room.name, result.rows[0].id);
    }

    const seedDateResult = await client.query(
      "SELECT (CURRENT_TIMESTAMP AT TIME ZONE $1)::date::text AS seed_date",
      [timeZone],
    );
    const seedDate = seedDateResult.rows[0].seed_date;

    // Remove existing demo bookings before re-seeding so shifted demo dates from previous runs
    // do not violate the bookings_no_room_overlap exclusion constraint during step-by-step updates.
    const demoIds = Array.from(new Set(DEMO_BOOKINGS.map((booking) => booking.id)));
    await client.query("DELETE FROM bookings WHERE id = ANY($1::uuid[])", [demoIds]);

    for (const booking of DEMO_BOOKINGS) {
      // PostgreSQL converts Kyiv wall-clock values into unambiguous UTC instants.
      // Color defaults to 'sage' if unspecified, adhering to the bookings_color_check constraint ('sage', 'blue', 'violet', 'amber', 'rose', 'slate').
      await client.query(
        `
          INSERT INTO bookings (
            id,
            room_id,
            author_id,
            title,
            color,
            start_at,
            end_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            (($6::date + $7::integer) + $8::time) AT TIME ZONE $10,
            (($6::date + $7::integer) + $9::time) AT TIME ZONE $10
          )
          ON CONFLICT (id) DO UPDATE
          SET
            room_id = EXCLUDED.room_id,
            author_id = EXCLUDED.author_id,
            title = EXCLUDED.title,
            color = EXCLUDED.color,
            start_at = EXCLUDED.start_at,
            end_at = EXCLUDED.end_at,
            updated_at = now()
        `,
        [
          booking.id,
          roomIds.get(booking.room),
          userIds.get(booking.author),
          booking.title,
          booking.color ?? "sage",
          seedDate,
          booking.dayOffset,
          booking.startTime,
          booking.endTime,
          timeZone,
        ],
      );
    }

    await client.query("COMMIT");
    console.log(
      `Seeded ${ROOMS.length} rooms, ${TEST_USERS.length} users, and ${DEMO_BOOKINGS.length} bookings relative to ${seedDate} (${timeZone}).`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

try {
  await seed();
} catch (error) {
  console.error("Seed failed.", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
