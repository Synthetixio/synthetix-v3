const path = require('path');
const { task, subtask } = require('hardhat/config');
const { glob } = require('hardhat/internal/util/glob');
const { TASK_TEST_GET_TEST_FILES } = require('hardhat/builtin-tasks/task-names');

task('test:integration').setAction(async (_, __, runSuper) => {
  subtask(TASK_TEST_GET_TEST_FILES).setAction(async ({ testFiles }, { config }) => {
    if (testFiles.length !== 0) {
      return testFiles;
    }

    return await glob(path.join(config.paths.tests, 'integration/**/*.test.js'));
  });

  return await runSuper();
});
