const path = require('path');
const { subtask } = require('hardhat/config');
const { glob } = require('hardhat/internal/util/glob');
const { TASK_TEST_GET_TEST_FILES } = require('hardhat/builtin-tasks/task-names');

// Allow glob patterns on testFiles parameter for 'hardhat test' task
// e.g.: yarn hardhat test test/unit/**/*.test.js
subtask(TASK_TEST_GET_TEST_FILES).setAction(async (args, { config }, runSuper) => {
  const testFiles = (
    await Promise.all(
      args.testFiles.map((testFile) => glob(path.resolve(config.paths.root, testFile)))
    )
  ).flat();

  return await runSuper({ ...args, testFiles });
});
