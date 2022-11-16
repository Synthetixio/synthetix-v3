import { task, subtask } from 'hardhat/config';
import { timed } from '../internal/timed';
import * as taskNames from '../task-names';

for (const [taskKey, taskName] of Object.entries(taskNames)) {
  const factory = taskKey.startsWith('TASK_') ? task : subtask;

  factory(taskName, async (_, __, runSuper) => {
    const prefix = taskKey.startsWith('TASK_') ? 'task' : 'subtask';
    return await timed(`${prefix} ${taskName}`, runSuper);
  });
}
