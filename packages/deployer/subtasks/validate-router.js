const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { getModules } = require('../utils/getModules');
const { getContractSelectors } = require('../utils/getSelectors');
const { SUBTASK_VALIDATE_ROUTER } = require('../task-names');
const { readRouterSource } = require('../utils/routerSource');

let _hre;

/*
 * Runs a series of calidations against a generated router source.
 * */
subtask(SUBTASK_VALIDATE_ROUTER).setAction(async (_, hre) => {
  _hre = hre;

  logger.subtitle('Validating router');

  await _selectorsExistInSource();
});

async function _selectorsExistInSource() {
  const source = readRouterSource({ hre: _hre });
  const modules = getModules({ hre: _hre });

  for (let i = 0; i < modules.length; i++) {
    const module = modules[i];
    const moduleSelectors = await getContractSelectors({ contractName: module.name, hre: _hre });

    moduleSelectors.map((moduleSelector) => {
      const regex = `^.*case ${moduleSelector.selector}.*$`;
      const matches = source.match(new RegExp(regex, 'gm'));
      if (matches.length !== 1) {
        throw new Error(
          `Selector case found ${matches.length} times instead of the expected single time. Regex: ${regex}. Matches: ${matches}`
        );
      }

      const match = matches[0];
      if (!match.includes(module.name)) {
        throw new Error(`Expected to find ${module.name} in the selector case: ${match}`);
      }

      logger.checked(`${module.name}.${moduleSelector.name} selector found in the router`);
    });
  }
}
