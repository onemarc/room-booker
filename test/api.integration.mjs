import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.ROOM_BOOKER_BASE_URL ?? "http://localhost:3000";

async function request(path, { cookie, method = "GET", body } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      Accept: "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body
        ? {
            "Content-Type": "application/json",
            Origin: new URL(baseUrl).origin,
          }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const data = await response.json();
  return { response, data };
}

async function login(email, password) {
  const { response, data } = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(response.status, 200, JSON.stringify(data));
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Login must issue a session cookie.");
  return setCookie.split(";", 1)[0];
}

function getKyivDate(daysFromNow) {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function getKyivTime(instant) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.hour}:${value.minute}`;
}

test("booking API creates, protects, validates, and cancels a booking", async () => {
  const ownerCookie = await login(
    "paul@room-booker.local",
    "RoomBooker123!",
  );
  const otherCookie = await login(
    "mark@room-booker.local",
    "KyivOffice123!",
  );
  const date = getKyivDate(21);
  const roomsResult = await request(
    `/api/rooms?date=${date}&timeZone=Europe%2FKyiv&minCapacity=1`,
    { cookie: ownerCookie },
  );
  assert.equal(roomsResult.response.status, 200, JSON.stringify(roomsResult.data));
  const capacityResult = await request(
    `/api/rooms?date=${date}&timeZone=Europe%2FKyiv&minCapacity=12`,
    { cookie: ownerCookie },
  );
  assert.equal(
    capacityResult.response.status,
    200,
    JSON.stringify(capacityResult.data),
  );
  assert.ok(
    capacityResult.data.rooms.every((candidate) => candidate.capacity >= 12),
  );
  const room = roomsResult.data.rooms?.find(
    (candidate) => candidate.availableStarts.length > 0,
  );
  assert.ok(room, "A seeded room must expose a future free slot.");

  const start = new Date(room.availableStarts[0]);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const payload = {
    roomId: room.id,
    title: `API integration ${Date.now()}`,
    date,
    endDate: date,
    startTime: getKyivTime(start),
    endTime: getKyivTime(end),
    timeZone: "Europe/Kyiv",
    color: "sage",
    recurrenceCount: 1,
  };

  const outsideHours = await request("/api/bookings", {
    cookie: ownerCookie,
    method: "POST",
    body: {
      ...payload,
      title: `${payload.title} outside hours`,
      startTime: "08:00",
      endTime: "08:30",
    },
  });
  assert.equal(outsideHours.response.status, 400, JSON.stringify(outsideHours.data));
  assert.equal(outsideHours.data.error?.code, "outside_working_hours");

  let bookingId;
  try {
    const created = await request("/api/bookings", {
      cookie: ownerCookie,
      method: "POST",
      body: payload,
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.data));
    bookingId = created.data.booking?.id;
    assert.ok(bookingId);

    const overlap = await request("/api/bookings", {
      cookie: ownerCookie,
      method: "POST",
      body: { ...payload, title: `${payload.title} overlap` },
    });
    assert.equal(overlap.response.status, 409, JSON.stringify(overlap.data));
    assert.equal(overlap.data.error?.code, "slot_occupied");

    const forbidden = await request(`/api/bookings/${bookingId}`, {
      cookie: otherCookie,
      method: "DELETE",
      body: {},
    });
    assert.equal(forbidden.response.status, 404, JSON.stringify(forbidden.data));
  } finally {
    if (bookingId) {
      const cancelled = await request(`/api/bookings/${bookingId}`, {
        cookie: ownerCookie,
        method: "DELETE",
        body: {},
      });
      assert.equal(cancelled.response.status, 200, JSON.stringify(cancelled.data));
      assert.equal(cancelled.data.cancelled?.count, 1);
    }
  }

  const raceDate = getKyivDate(23);
  const racePayload = {
    ...payload,
    date: raceDate,
    endDate: raceDate,
    title: `Concurrent booking ${Date.now()}`,
  };
  const raceResults = await Promise.all([
    request("/api/bookings", {
      cookie: ownerCookie,
      method: "POST",
      body: racePayload,
    }),
    request("/api/bookings", {
      cookie: otherCookie,
      method: "POST",
      body: racePayload,
    }),
  ]);
  try {
    assert.deepEqual(
      raceResults.map(({ response }) => response.status).sort(),
      [201, 409],
    );
  } finally {
    for (const [index, result] of raceResults.entries()) {
      if (result.response.status === 201 && result.data.booking?.id) {
        const raceCancelled = await request(
          `/api/bookings/${result.data.booking.id}`,
          {
            cookie: index === 0 ? ownerCookie : otherCookie,
            method: "DELETE",
            body: {},
          },
        );
        assert.equal(
          raceCancelled.response.status,
          200,
          JSON.stringify(raceCancelled.data),
        );
      }
    }
  }

  const recurringDate = getKyivDate(28);
  const recurringTitle = `Recurring API integration ${Date.now()}`;
  const recurring = await request("/api/bookings", {
    cookie: ownerCookie,
    method: "POST",
    body: {
      ...payload,
      title: recurringTitle,
      date: recurringDate,
      endDate: recurringDate,
      recurrenceCount: 3,
    },
  });
  assert.equal(recurring.response.status, 201, JSON.stringify(recurring.data));
  const recurringBookingId = recurring.data.booking?.id;
  assert.ok(recurringBookingId);
  try {
    const mine = await request("/api/bookings/mine?section=upcoming", {
      cookie: ownerCookie,
    });
    assert.equal(mine.response.status, 200, JSON.stringify(mine.data));
    const seriesRows = mine.data.bookings.filter(
      (booking) => booking.title === recurringTitle,
    );
    assert.equal(seriesRows.length, 3);
    assert.ok(seriesRows[0].seriesId);
    assert.ok(
      seriesRows.every(
        (booking) => booking.seriesId === seriesRows[0].seriesId,
      ),
    );
  } finally {
    const seriesCancelled = await request(
      `/api/bookings/${recurringBookingId}?scope=series`,
      {
        cookie: ownerCookie,
        method: "DELETE",
        body: {},
      },
    );
    assert.equal(
      seriesCancelled.response.status,
      200,
      JSON.stringify(seriesCancelled.data),
    );
    assert.equal(seriesCancelled.data.cancelled?.count, 3);
  }
});
