const {
  findYulCaseValues,
  findFunctionSelectors,
} = require('@synthetixio/core-js/utils/ast/finders');
const { getModulesSelectors } = require('./contract-helper');
const { toPrivateConstantCase } = require('./router-helper');
const filterValues = require('filter-values');
const { onlyRepeated } = require('@synthetixio/core-js/utils/misc/array-filters');

class RouterASTValidator {
  constructor(asts) {
    this.asts = asts;
  }

  async findMissingModuleSelectors() {
    const moduleSelectors = await getModulesSelectors();
    const routerSelectors = findYulCaseValues('Router', this.asts['Router']);

    const errors = [];

    for (const contractSelector of moduleSelectors) {
      const selectorExists = routerSelectors.some((s) => s.selector === contractSelector.selector);

      if (!selectorExists) {
        errors.push({
          msg: `Selector for ${contractSelector.contractName}.${contractSelector.name} not found in the router`,
          contractSelector,
          missingInRouter: true,
        });
      }
    }

    for (const routerSelector of routerSelectors) {
      const selectorExists = moduleSelectors.some((s) => s.selector === routerSelector.selector);

      if (!selectorExists) {
        errors.push({
          msg: `Selector ${routerSelector.selector} is present in router but not found in contracts`,
          routerSelector,
          onlyInRouter: true,
        });
      }
    }

    return errors;
  }

  async findUnreachableModuleSelectors() {
    const routerSelectors = findYulCaseValues('Router', this.asts['Router']);

    const moduleDeploymentData = filterValues(
      hre.deployer.deployment.general.contracts,
      (c) => c.isModule
    );

    const moduleAddresses = [];
    for (const [moduleName, moduleData] of Object.entries(moduleDeploymentData)) {
      moduleAddresses[toPrivateConstantCase(moduleName)] = {
        moduleName,
        address: moduleData.deployedAddress,
      };
    }

    const errors = [];

    for (const s of routerSelectors) {
      const selectorReachable =
        moduleAddresses[s.value.name] &&
        moduleAddresses[s.value.name].address === s.value.value.value;

      if (!selectorReachable) {
        errors.push({
          msg: `Selector ${s.selector} not reachable. ${s.value.name} pointing to ${
            s.value.value.value
          } instead of ${moduleAddresses[s.value.name].address}`,
        });
      } else {
        const contractSelectors = findFunctionSelectors(
          moduleAddresses[s.value.name].moduleName,
          this.asts
        );

        if (!contractSelectors.some((cs) => cs.selector === s.selector)) {
          errors.push({
            msg: `Selector ${s.selector} not reachable. ${s.value.name} (${
              moduleAddresses[s.value.name].moduleName
            }) doesn't contain a function with that selector`,
          });
        }
      }
    }

    return errors;
  }

  async findDuplicateModuleSelectors() {
    const routerSelectors = findYulCaseValues('Router', this.asts['Router']);

    const duplicates = routerSelectors.map((s) => s.selector).filter(onlyRepeated);

    const errors = duplicates.map((duplicate) => ({
      msg: `Selector ${duplicate.selector} is present multiple times in the router`,
    }));

    return errors;
  }
}

module.exports = RouterASTValidator;
