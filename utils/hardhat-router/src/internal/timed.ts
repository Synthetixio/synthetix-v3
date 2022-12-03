import logger from '@synthetixio/core-utils/utils/io/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function timed<T extends (...args: any[]) => any>(
  title: string,
  fn: T,
  ...args: Parameters<T>
) {
  const now = Date.now();
  const result = await fn(...args);
  logger.info(`${title}: ${Date.now() - now}ms`);
  return result as ReturnType<T>;
}
