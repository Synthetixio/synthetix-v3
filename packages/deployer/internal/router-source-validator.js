const fs = require('fs');
const path = require('path');
const relativePath = require('@synthetixio/core-js/utils/relative-path');
const { getModulesSelectors } = require('./contract-helper');

function getRouterSource() {
  const routerPath = path.join(
    relativePath(hre.config.paths.sources, hre.config.paths.root),
    'Router.sol'
  );

  const source = fs.readFileSync(routerPath).toString();
  return source;
}

async function findRepeatedSelectorsInSource() {
  const moduleSelectors = await getModulesSelectors();
  const source = getRouterSource();

  const errors = [];
  moduleSelectors.forEach((moduleSelector) => {
    const regex = `(:?\\s|^)case ${moduleSelector.selector}\\s.+`;
    const matches = source.match(new RegExp(regex, 'gm'));

    if (matches && matches.length > 1) {
      if (!errors.some((value) => value.selector === moduleSelector.selector)) {
        errors.push({
          msg: `Selector case ${moduleSelector.selector} found ${matches.length} times instead of the expected single time. Matches: ${matches}`,
          repeatedInRouter: true,
          selector: moduleSelector.selector,
        });
      }
    }
  });
  return errors;
}

async function findMissingSelectorsInSource() {
  const moduleSelectors = await getModulesSelectors();
  const source = getRouterSource();

  const errors = [];
  moduleSelectors.forEach((moduleSelector) => {
    const regex = `(:?\\s|^)case ${moduleSelector.selector}\\s.+`;
    const matches = source.match(new RegExp(regex, 'gm'));

    if (!matches || matches.length < 1) {
      errors.push({
        msg: `Selector for ${moduleSelector.contractName}.${moduleSelector.name} not found in router`,
        moduleSelector,
        missingInRouter: true,
      });
    }
  });
  return errors;
}

async function findWrongSelectorsInSource() {
  const moduleSelectors = await getModulesSelectors();
  const source = getRouterSource();

  const errors = [];
  moduleSelectors.forEach((moduleSelector) => {
    const regex = `(:?\\s|^)case ${moduleSelector.selector}\\s.+`;
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
