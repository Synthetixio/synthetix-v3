const fs = require('fs');
const logger = require('@synthetixio/core-js/utils/logger');
const path = require('path');
const relativePath = require('@synthetixio/core-js/utils/relative-path');
const { subtask } = require('hardhat/config');
const { getSelectors } = require('@synthetixio/core-js/utils/contracts');
const { SUBTASK_VALIDATE_ROUTER } = require('../task-names');

subtask(
  SUBTASK_VALIDATE_ROUTER,
  'Runs a series of validations against a generated router source.'
).setAction(async (_, hre) => {
  logger.subtitle('Validating router');

  const routerPath = path.join(
    relativePath(hre.config.paths.sources, hre.config.paths.root),
    'Router.sol'
  );

  const modulesNames = Object.entries(hre.deployer.data.contracts)
    .filter(([, c]) => c.isModule)
    .map(([moduleName]) => moduleName);

  await _selectorsExistInSource({
    routerPath,
    modulesNames,
  });

  logger.checked('Router is valid');
});

async function _selectorsExistInSource({ routerPath, modulesNames }) {
  const source = fs.readFileSync(routerPath).toString();

  for (const moduleName of modulesNames) {
    const moduleArtifacts = await hre.artifacts.readArtifact(moduleName);
    const moduleSelectors = await getSelectors(moduleArtifacts.abi);

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
