export const OFFICE_TIME_ZONE = "Europe/Kyiv";
export const OFFICE_OPEN_HOUR = 9;
export const OFFICE_CLOSE_HOUR = 19;

// Keep the product's office-time invariant centralized for seeds and future rules.
export function getOfficeConfiguration(environment = process.env) {
  const timeZone =
    environment.OFFICE_TIME_ZONE?.trim() || OFFICE_TIME_ZONE;
  const openHour = Number(
    environment.OFFICE_OPEN_HOUR ?? OFFICE_OPEN_HOUR,
  );
  const closeHour = Number(
    environment.OFFICE_CLOSE_HOUR ?? OFFICE_CLOSE_HOUR,
  );

  if (
    timeZone !== OFFICE_TIME_ZONE ||
    openHour !== OFFICE_OPEN_HOUR ||
    closeHour !== OFFICE_CLOSE_HOUR
  ) {
    throw new Error(
      "The current product baseline requires Europe/Kyiv office hours from 09:00 to 19:00.",
    );
  }

  return {
    timeZone,
    openHour,
    closeHour,
  };
}
