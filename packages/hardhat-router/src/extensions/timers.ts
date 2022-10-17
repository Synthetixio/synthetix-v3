import { task, subtask } from 'hardhat/config';
import logger from '@synthetixio/core-utils/utils/io/logger';
import * as taskNames from '../task-names';

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
