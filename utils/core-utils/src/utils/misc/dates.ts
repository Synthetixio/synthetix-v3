export function getUnixTimestamp(date = new Date()) {
  return Math.floor(date.getTime() / 1000);
}

export function fromUnixTimestamp(timestamp: number) {
  return new Date(timestamp * 1000);
}

export const daysToSeconds = (days: number) => days * 3600 * 24;
