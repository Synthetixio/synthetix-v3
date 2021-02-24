const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { getContractSelectors } = require('../utils/contracts');
const { SUBTASK_VALIDATE_ROUTER } = require('../task-names');
const { readRouterSource } = require('../utils/io');

let _hre;

/*
 * Runs a series of calidations against a generated router source.
 * */
subtask(SUBTASK_VALIDATE_ROUTER).setAction(async (_, hre) => {
  _hre = hre;

  logger.subtitle('Validating router');

  await _selectorsExistInSource();

  logger.checked('Router is valid');
});

async function _selectorsExistInSource() {
  const source = readRouterSource({ hre: _hre });

  for (let i = 0; i < _hre.deployer.sources.length; i++) {
    const module = _hre.deployer.sources[i];
    const moduleSelectors = await getContractSelectors({ contractName: module, hre: _hre });

    moduleSelectors.map((moduleSelector) => {
      const regex = `^.*case ${moduleSelector.selector}.*$`;
      const matches = source.match(new RegExp(regex, 'gm'));
      if (matches.length !== 1) {
        throw new Error(
          `Selector case found ${matches.length} times instead of the expected single time. Regex: ${regex}. Matches: ${matches}`
        );
      }

      const match = matches[0];
      if (!match.includes(module)) {
        throw new Error(`Expected to find ${module} in the selector case: ${match}`);
      }

      logger.debug(`${module}.${moduleSelector.name} selector found in the router`);
    });
  }
}
