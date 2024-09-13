/**
 * Helper function to write output to the console, uses process.stdout.write and
 * write in chunks because bash piping seems to have some sort of a problem with
 * outputting huge amounts of data all at once while using pipes.
 */
export function logInChunks(data: unknown) {
  const _data = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const chunkSize = 16;

  for (let i = 0; i < _data.length; i += chunkSize) {
    process.stdout.write(_data.slice(i, i + chunkSize));
  }

  return _data;
}
