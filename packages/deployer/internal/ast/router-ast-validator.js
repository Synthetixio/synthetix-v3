const { getCaseSelectors } = require('./ast-helper');
const { getModulesSelectors } = require('../contract-helper');
const { toPrivateConstantCase } = require('../router-helper');

async function findMissingSelectorsInAST(contracts) {
  const contractsSelectors = await getModulesSelectors();
  const routerSelectors = getCaseSelectors('Router', contracts['Router']);

  const errors = [];
  contractsSelectors.forEach((contractSelector) => {
    if (!routerSelectors.some((s) => s.selector === contractSelector.selector)) {
      errors.push({
        msg: `Selector for ${contractSelector.contractName}.${contractSelector.name} not found in the router`,
        contractSelector,
        missingInRouter: true,
      });
    }
  });

  routerSelectors.forEach((routerSelector) => {
    if (!contractsSelectors.some((s) => s.selector === routerSelector.selector)) {
      errors.push({
        msg: `Selector ${routerSelector.selector} is present in router but not found in contracts`,
        routerSelector,
        onlyInRouter: true,
      });
    }
  });

  return errors;
}

async function findUnreachableSelectorsInAST(contracts, modules) {
  const routerSelectors = getCaseSelectors('Router', contracts['Router']);
  const moduleAddresses = [];
  for (const [moduleName, moduleData] of Object.entries(modules)) {
    moduleAddresses[toPrivateConstantCase(moduleName)] = moduleData.deployedAddress;
  }

  const errors = [];
  routerSelectors.forEach((s) => {
    if (!moduleAddresses[s.value.name] || moduleAddresses[s.value.name] !== s.value.value.value) {
      errors.push({
        msg: `Selector ${s.selector} not reachable. ${s.value.name} pointing to ${
          s.value.value.value
        } instead of ${moduleAddresses[s.value.name]}`,
      });
    }
  });

  return errors;
}

async function findDuplicateSelectorsInAST(contracts) {
  const routerSelectors = getCaseSelectors('Router', contracts['Router']);

  const duplicates = routerSelectors.filter(
    (s, index, selectors) =>
      selectors.indexOf(selectors.find((n) => n.selector === s.selector)) !== index
  );

  const errors = [];
  duplicates.forEach((duplicate) => {
    errors.push({
      msg: `Selector ${duplicate.selector} is present multiple times in the router`,
    });
  });

  return errors;
}

module.exports = {
  findDuplicateSelectorsInAST,
  findMissingSelectorsInAST,
  findUnreachableSelectorsInAST,
};
