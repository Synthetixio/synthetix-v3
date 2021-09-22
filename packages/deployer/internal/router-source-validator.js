const fs = require('fs');
const path = require('path');
const relativePath = require('@synthetixio/core-js/utils/relative-path');
const { getContractSelectors } = require('./contract-helper');

function getRouterSource() {
  const routerPath = path.join(
    relativePath(hre.config.paths.sources, hre.config.paths.root),
    'Router.sol'
  );

  const source = fs.readFileSync(routerPath).toString();
  return source;
}

async function findRepeatedSelectorsInSource() {
  const moduleSelectors = await getContractSelectors(true);
  const source = getRouterSource();

  const errors = [];
  moduleSelectors.forEach((moduleSelector) => {
    const regex = `(:?\\s|^)case ${moduleSelector.selector.selector}\\s.+`;
    const matches = source.match(new RegExp(regex, 'gm'));

    if (matches && matches.length > 1) {
      errors.push({
        msg: `Selector case found ${matches.length} times instead of the expected single time. Regex: ${regex}. Matches: ${matches}`,
        repeatedInRouter: true,
      });
    }
  });
  return errors;
}

async function findMissingSelectorsInSource() {
  const moduleSelectors = await getContractSelectors(true);
  const source = getRouterSource();

  const errors = [];
  moduleSelectors.forEach((moduleSelector) => {
    const regex = `(:?\\s|^)case ${moduleSelector.selector.selector}\\s.+`;
    const matches = source.match(new RegExp(regex, 'gm'));

    if (!matches || matches.length < 1) {
      errors.push({
        msg: `Selector for ${moduleSelector.contractName}.${moduleSelector.selector.name} not found in router`,
        moduleSelector,
        missingInRouter: true,
      });
    }
  });
  return errors;
}

async function findWrongSelectorsInSource() {
  const moduleSelectors = await getContractSelectors(true);
  const source = getRouterSource();

  const errors = [];
  moduleSelectors.forEach((moduleSelector) => {
    const regex = `(:?\\s|^)case ${moduleSelector.selector.selector}\\s.+`;
    const matches = source.match(new RegExp(regex, 'gm'));

    if (!matches) return;
    if (matches.length !== 1) return;

    const [match] = matches;
    if (!match.includes(moduleSelector.contractName)) {
      errors.push({
        msg: `Expected to find ${moduleSelector.contractName} in the selector case: ${match}`,
        moduleSelector,
        missingInRouter: true,
      });
    }
  });
  return errors;
}

module.exports = {
  findMissingSelectorsInSource,
  findRepeatedSelectorsInSource,
  findWrongSelectorsInSource,
};
