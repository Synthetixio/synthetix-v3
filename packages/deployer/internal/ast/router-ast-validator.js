const { getCaseSelectors } = require('./ast-helper');
const { getModulesSelectors } = require('../contract-helper');
const logger = require('@synthetixio/core-js/utils/logger');

async function findMissingSelectorsInAST(contracts) {
  const contractsSelectors = await getModulesSelectors();
  const routerSelectors = getCaseSelectors('Router', contracts['Router']);

  const errors = [];
  contractsSelectors.forEach((contractSelector) => {
    if (!routerSelectors.includes(contractSelector.selector)) {
      errors.push({
        msg: `Selector for ${contractSelector.contractName}.${contractSelector.name} not found in the router`,
        contractSelector,
        missingInRouter: true,
      });
    }
  });

  routerSelectors.forEach((routerSelector) => {
    if (!contractsSelectors.some((item) => item.selector === routerSelector)) {
      errors.push({
        msg: `Selector ${routerSelector} is present in router but not found in contracts`,
        routerSelector,
        onlyInRouter: true,
      });
    }
  });

  return errors;
}

async function findUnreachableSelectorsInAST() {
  logger.info('Unreachable selectors not checked yet in compiled router');

  return [];
}

async function findDuplicateSelectorsInAST() {
  logger.info('Duplicated selectors not checked yet in compiled router');

  return [];
}

module.exports = {
  findDuplicateSelectorsInAST,
  findMissingSelectorsInAST,
  findUnreachableSelectorsInAST,
};
