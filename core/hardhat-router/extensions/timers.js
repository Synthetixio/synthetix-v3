const { task, subtask } = require('hardhat/config');
const { default: logger } = require('@synthetixio/core-utils/utils/io/logger');
const taskNames = require('../task-names');

for (const [taskKey, taskName] of Object.entries(taskNames)) {
  const factory = taskKey.startsWith('TASK_') ? task : subtask;

  factory(taskName, async (_, __, runSuper) => {
    const now = Date.now();

    const result = await runSuper();

    const title = taskKey.startsWith('TASK_') ? 'task' : 'subtask';
    logger.info(`${title} ${taskName}: ${Date.now() - now}ms`);

    return result;
  });
}
