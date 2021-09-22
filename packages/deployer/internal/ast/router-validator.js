const { getCaseSelectors } = require('./ast-helper');
const { getContractSelectors } = require('../contract-helper');
const logger = require('@synthetixio/core-js/utils/logger');

async function findMissingSelectorsInAST(contracts) {
  const contractsSelectors = await getContractSelectors(true);

  const routerSelectors = getCaseSelectors('Router', contracts['Router']);

  const errors = [];
  contractsSelectors.forEach((contractSelector) => {
    if (!routerSelectors.includes(contractSelector.selector.selector)) {
      errors.push({
        msg: `${contractSelector.moduleName}.${contractSelector.selector.name} selector not found in the router`,
        contractSelector,
        missingInRouter: true,
      });
    }
  });

  routerSelectors.forEach((routerSelector) => {
    if (!contractsSelectors.some((item) => item.selector.selector === routerSelector)) {
      errors.push({
        msg: `${routerSelector} selector in router not found in contracts`,
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
