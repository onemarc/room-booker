export const OFFICE_TIME_ZONE: "Europe/Kyiv";
export const OFFICE_OPEN_HOUR: 9;
export const OFFICE_CLOSE_HOUR: 19;

export type OfficeConfiguration = {
  timeZone: typeof OFFICE_TIME_ZONE;
  openHour: typeof OFFICE_OPEN_HOUR;
  closeHour: typeof OFFICE_CLOSE_HOUR;
};

export function getOfficeConfiguration(
  environment?: NodeJS.ProcessEnv,
): OfficeConfiguration;
