/*global task*/
/*eslint no-undef: "error"*/
/*eslint no-unused-vars: ["error", { "varsIgnorePattern": "[NAME,DESC]" }]*/

const {
  TASK_INTERACT_NAME,
  TASK_INTERACT_DESC,
  TASK_NOMINATE_OWNER_NAME,
  TASK_NOMINATE_OWNER_DESC,
  TASK_ACCEPT_OWNERSHIP_NAME,
  TASK_ACCEPT_OWNERSHIP_DESC,
  TASK_STATUS_NAME,
  TASK_STATUS_DESC,
} = require('../tasks-info');

task(TASK_STATUS_NAME, TASK_STATUS_DESC, async function () {
  console.log('Task Not Implemented: ', TASK_STATUS_NAME);
});
