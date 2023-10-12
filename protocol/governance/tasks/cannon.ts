import { task } from 'hardhat/config';

function keepAlive() {
  let running = true;

  const stop = () => {
    running = false;
  };

  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  process.on('uncaughtException', stop);

  return new Promise<void>((resolve) => {
    function run() {
      setTimeout(() => {
        running ? run() : resolve();
      }, 10);
    }

    run();
  });
}

/**
 * Hack to avoid this error: https://github.com/usecannon/cannon/issues/501
 * We need to keep the nodes running during tests
 */
task('cannon:run', 'Keep Alive cannon:run hack', async function (args, hre, runSuper) {
  const res = await runSuper();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((args as any).logs) {
    await keepAlive();
  }
  return res;
});
