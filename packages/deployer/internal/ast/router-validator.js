const fs = require('fs');
const path = require('path');
const { getCaseSelectors } = require('./ast-helper');
const relativePath = require('@synthetixio/core-js/utils/relative-path');
const filterValues = require('filter-values');
const { getSelectors } = require('@synthetixio/core-js/utils/contracts');
const logger = require('@synthetixio/core-js/utils/logger');

async function getContractSelectors(onlyModules) {
  const modules = onlyModules
    ? filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule)
    : hre.deployer.deployment.general.contracts;
  const modulesNames = Object.keys(modules);

  const items = [];
  for (const moduleName of modulesNames) {
    const moduleArtifacts = await hre.artifacts.readArtifact(moduleName);
    const selectors = await getSelectors(moduleArtifacts.abi);
    selectors.forEach((selector) => {
      items.push({ selector, moduleName });
    });
  }
  return items;
}

function getRouterSource() {
  const routerPath = path.join(
    relativePath(hre.config.paths.sources, hre.config.paths.root),
    'Router.sol'
  );

  const source = fs.readFileSync(routerPath).toString();
  return source;
}

async function findMissingSelectors() {
  const moduleSelectors = await getContractSelectors(true);
  const source = getRouterSource();

  moduleSelectors.forEach((moduleSelector) => {
    const regex = `(:?\\s|^)case ${moduleSelector.selector.selector}\\s.+`;
    const matches = source.match(new RegExp(regex, 'gm'));

    if (matches.length !== 1) {
      throw new Error(
        `Selector case found ${matches.length} times instead of the expected single time. Regex: ${regex}. Matches: ${matches}`
      );
    }

    const [match] = matches;
    if (!match.includes(moduleSelector.moduleName)) {
      throw new Error(
        `Expected to find ${moduleSelector.moduleName} in the selector case: ${match}`
      );
    }

    logger.debug(
      `${moduleSelector.moduleName}.${moduleSelector.selector.name} selector found in the router`
    );
  });
  return false;
}

async function findMissingSelectorsCompiled(contracts) {
  const contractsSelectors = await getContractSelectors(true);

  const routerSelectors = getCaseSelectors('Router', contracts['Router']);

  const errors = [];

  contractsSelectors.forEach((contractSelector) => {
    if (!routerSelectors.includes(contractSelector.selector.selector)) {
      logger.error(
        `${contractSelector.moduleName}.${contractSelector.selector.name} selector not found in the router`
      );
      errors.push({
        msg: `${contractSelector.moduleName}.${contractSelector.selector.name} selector not found in the router`,
        contractSelector,
        missingInRouter: true,
      });
    }
  });

  routerSelectors.forEach((routerSelector) => {
    if (!contractsSelectors.some((item) => item.selector.selector === routerSelector)) {
      logger.error(`${routerSelector} selector in router not found in contracts`);
      errors.push({
        msg: `${routerSelector} selector in router not found in contracts`,
        routerSelector,
        onlyInRouter: true,
      });
    }
  });

  return errors.length > 0 ? errors : null;
}

async function findUnreachableSelectorsCompiled() {
  logger.info('Unreachable selectors not checked yet in compiled router');
  return null;
}

async function findDuplicateSelectorsCompiled() {
  logger.info('Duplicated selectors not checked yet in compiled router');
  return null;
}

module.exports = {
  findDuplicateSelectorsCompiled,
  findMissingSelectors,
  findMissingSelectorsCompiled,
  findUnreachableSelectorsCompiled,
};
