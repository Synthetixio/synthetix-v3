import { spawn as nodeSpawn } from 'node:child_process';
import debug from 'debug';

interface Options {
  timeout?: number;
  waitForText?: string | ((data: string) => boolean);
  waitForClose?: boolean;
  env?: { [key: string]: string };
}

export async function spawn(cmd: string, args: string[] = [], opts: Options = {}) {
  const { pEvent } = await import('p-event');

  const spawnOptions = {
    timeout: opts.timeout,
    env: { ...process.env, ...(opts.env || {}) },
  };

  const envs = opts.env
    ? Object.entries(opts.env)
        .map((e) => e.join('='))
        .join(' ') + ' '
    : '';

  const cmdPrint = `${envs}${cmd} ${args.join(' ')}`;

  const child = nodeSpawn(cmd, args, spawnOptions);

  console.log(`  Spawn(pid: ${child.pid}): ${cmdPrint}`);

  const log = debug(`spawn:${child.pid}`);

  log(`spawn: ${cmdPrint}`);

  process.on('exit', function () {
    child.kill();
  });

  let output = '';
  if (child.stdout) {
    child.stdout.on('data', (data: unknown) => {
      const msg = `${data}`.trim();
      output += msg;
      if (msg) log(msg);
    });
  }

  let lastErrMessage = '';
  let errOutput = '';
  const err = new Error();
  if (child.stderr) {
    child.stderr.on('data', (data: unknown) => {
      const msg = `${data}`.trim();
      errOutput += '';
      if (msg) {
        log(msg);
        lastErrMessage = msg;
      }
    });
  }

  child.on('close', () => {
    console.log(`  Close(pid: ${child.pid} - exitCode: ${child.exitCode}): ${cmdPrint}`);
    if (child.exitCode !== 0) {
      err.message = lastErrMessage || `There was an error when running "${cmd} ${args.join(' ')}".`;
      throw err;
    }
  });

  child.on('error', (err) => {
    log(err);
  });

  // Wait for the desired text to appear, or fail when the process closes (most likely an error)
  if (opts.waitForText) {
    const event = await Promise.race([
      pEvent(child.stdout, 'data', {
        filter: (data: unknown) => {
          return typeof opts.waitForText === 'string'
            ? `${data}`.includes(opts.waitForText)
            : opts.waitForText!(`${data}`);
        },
      }).then(() => 'data'),
      pEvent(child, 'close').then(async () => 'close'),
    ]);

    if (event === 'close') {
      throw new Error(`Process closed before the expected event was emitted`);
    }
  } else if (opts.waitForClose) {
    // Wait for the process finish executing
    await pEvent(child, 'close');
  } else {
    // Wait for the child process to open
    await pEvent(child, 'spawn');
  }

  return { child, output, errOutput };
}
