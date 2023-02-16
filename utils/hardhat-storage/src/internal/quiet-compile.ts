import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

/*
 * Note: Even though hardhat's compile task has a quiet option,
 * it still prints some output. This is a hack to completely silence
 * output during compile task run.
 */
export async function quietCompile(hre: HardhatRuntimeEnvironment, quiet: boolean) {
  let logCache;

  if (quiet) {
    logCache = console.log;
    console.log = () => {};
  }

  try {
    await hre.run(TASK_COMPILE, { force: true, quiet: true });
  } finally {
    if (logCache) console.log = logCache;
  }
}
