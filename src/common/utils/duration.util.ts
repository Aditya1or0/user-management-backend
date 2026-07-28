export function parseDurationToMs(value: string): number {
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid duration format: ${value}`);
  }

  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${value}. Expected formats like '10s', '15m', '2h', '30d'.`);
  }

  const numericValue = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return numericValue * 1000;
    case 'm':
      return numericValue * 60 * 1000;
    case 'h':
      return numericValue * 60 * 60 * 1000;
    case 'd':
      return numericValue * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
}
