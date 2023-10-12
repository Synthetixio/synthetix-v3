import { spawn as nodeSpawn } from 'node:child_process';
import debug from 'debug';

const log = debug('synthetix:core-modules:spawn');

interface Options {
  waitForText?: (data: string) => boolean;
  env?: { [key: string]: string };
}

export async function spawn(cmd: string, args: string[] = [], opts: Options = {}) {
  const { pEvent } = await import('p-event');

  const spawnOptions = {
    env: { ...process.env, ...(opts.env || {}) },
  };

  log(`Running: ${cmd} ${args.join(' ')}`);

  const child = nodeSpawn(cmd, args, spawnOptions);

  process.on('exit', function () {
    child.kill();
  });

  if (child.stdout) {
    child.stdout.on('data', (data: unknown) => {
      const msg = `${data}`.trim();
      if (msg) log(msg);
    });
  }

  let lastErrMessage = '';
  const err = new Error();
  if (child.stderr) {
    child.stderr.on('data', (data: unknown) => {
      const msg = `${data}`.trim();
      if (msg) {
        log(msg);
        lastErrMessage = msg;
      }
    });
  }

  child.on('close', () => {
    if (child.exitCode !== 0) {
      err.message = lastErrMessage || `There was an error when running "${cmd} ${args.join(' ')}".`;
      throw err;
    }
  });

  // Wait for the child process to open
  await pEvent(child, 'spawn');

  if (!child.stdout) {
    throw new Error('Missing stdout');
  }

  // Wait for the anvil node to start, or fail when the process closes (most likely an error)
  if (opts.waitForText) {
    await Promise.race([
      pEvent(child, 'close'),
      pEvent(child.stdout, 'data', {
        timeout: 30000,
        filter: (data: unknown) => {
          return opts.waitForText ? opts.waitForText(`${data}`) : true;
        },
      }),
    ]);
  }

  return child;
}
