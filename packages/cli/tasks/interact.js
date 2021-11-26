const { task } = require('hardhat/config');

const { TASK_INTERACT } = require('../task-names');

task(TASK_INTERACT, 'Interacts with a given modular system deployment');
