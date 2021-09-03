const fs = require('fs');
const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { getContractNameFromPath, getContractSelectors } = require('../utils/contracts');
const { SUBTASK_VALIDATE_ROUTER } = require('../task-names');

subtask(
  SUBTASK_VALIDATE_ROUTER,
  'Runs a series of validations against a generated router source.'
).setAction(async () => {
  logger.subtitle('Validating router');

  await _selectorsExistInSource({
    routerPath: hre.deployer.paths.routerPath,
    modules: Object.keys(hre.deployer.data.contracts.modules).map(getContractNameFromPath),
  });

  logger.checked('Router is valid');
});

async function _selectorsExistInSource({ routerPath, modules }) {
  const source = fs.readFileSync(routerPath).toString();

  for (const moduleName of modules) {
    const moduleSelectors = await getContractSelectors(moduleName);

    moduleSelectors.forEach((moduleSelector) => {
      const regex = `(:?\\s|^)case ${moduleSelector.selector}\\s.+`;
      const matches = source.match(new RegExp(regex, 'gm'));

      if (matches.length !== 1) {
        throw new Error(
          `Selector case found ${matches.length} times instead of the expected single time. Regex: ${regex}. Matches: ${matches}`
        );
      }

      const [match] = matches;
      if (!match.includes(moduleName)) {
        throw new Error(`Expected to find ${moduleName} in the selector case: ${match}`);
      }

      logger.debug(`${moduleName}.${moduleSelector.name} selector found in the router`);
    });
  }
}
