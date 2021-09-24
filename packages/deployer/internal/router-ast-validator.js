const { getCaseSelectors, findFunctionSelectors } = require('@synthetixio/core-js/utils/ast');
const { getModulesSelectors } = require('./contract-helper');
const { toPrivateConstantCase } = require('./router-helper');
const filterValues = require('filter-values');

class RouterASTValidator {
  constructor(asts) {
    this.asts = asts;
  }

  async findMissingModuleSelectors() {
    const moduleSelectors = await getModulesSelectors();
    const routerSelectors = getCaseSelectors('Router', this.asts['Router']);

    const errors = [];
    moduleSelectors.forEach((contractSelector) => {
      if (!routerSelectors.some((s) => s.selector === contractSelector.selector)) {
        errors.push({
          msg: `Selector for ${contractSelector.contractName}.${contractSelector.name} not found in the router`,
          contractSelector,
          missingInRouter: true,
        });
      }
    });

    routerSelectors.forEach((routerSelector) => {
      if (!moduleSelectors.some((s) => s.selector === routerSelector.selector)) {
        errors.push({
          msg: `Selector ${routerSelector.selector} is present in router but not found in contracts`,
          routerSelector,
          onlyInRouter: true,
        });
      }
    });

    return errors;
  }

  async findUnreachableModuleSelectors() {
    const routerSelectors = getCaseSelectors('Router', this.asts['Router']);

    const moduleDeploymentData = filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule);

    const moduleAddresses = [];
    for (const [moduleName, moduleData] of Object.entries(moduleDeploymentData)) {
      moduleAddresses[toPrivateConstantCase(moduleName)] = {
        moduleName,
        address: moduleData.deployedAddress,
      };
    }

    const errors = [];
    routerSelectors.forEach((s) => {
      if (
        !moduleAddresses[s.value.name] ||
        moduleAddresses[s.value.name].address !== s.value.value.value
      ) {
        errors.push({
          msg: `Selector ${s.selector} not reachable. ${s.value.name} pointing to ${
            s.value.value.value
          } instead of ${moduleAddresses[s.value.name]}`,
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
    });

    return errors;
  }

  async findDuplicateModuleSelectors() {
    const routerSelectors = getCaseSelectors('Router', this.asts['Router']);

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
}

module.exports = RouterASTValidator;
