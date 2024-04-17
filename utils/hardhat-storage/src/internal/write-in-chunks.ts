/**
 * Helper function to write output to the console, uses process.stdout.write and
 * write in chunks because bash piping seems to have some sort of a problem with
 * outputting huge amounts of data all at once while using pipes.
 */
export function writeInChunks(data: string) {
  const chunkSize = 16;

  for (let i = 0; i < data.length; i += chunkSize) {
    process.stdout.write(data.slice(i, i + chunkSize));
  }

  return data;
}
