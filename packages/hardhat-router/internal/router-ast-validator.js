const {
  findContractNode,
  findYulCaseValues,
  findFunctionSelectors,
} = require('@synthetixio/core-js/dist/utils/ast/finders');
const { getModulesSelectors } = require('./contract-helper');
const { toPrivateConstantCase } = require('./router-helper');
const { onlyRepeated } = require('@synthetixio/core-js/dist/utils/misc/array-filters');

class RouterASTValidator {
  constructor(routerFullyQualifiedName, astNodes) {
    const routerContractNode = findContractNode(routerFullyQualifiedName, astNodes);
    this.routerSelectors = findYulCaseValues(routerContractNode);
    this.astNodes = astNodes;
  }

  async findMissingModuleSelectors() {
    const moduleSelectors = await getModulesSelectors();

    const errors = [];

    for (const contractSelector of moduleSelectors) {
      const selectorExists = this.routerSelectors.some(
        (s) => s.selector === contractSelector.selector
      );

      if (!selectorExists) {
        errors.push({
          msg: `Selector for ${contractSelector.contractName}.${contractSelector.name} not found in the router`,
          contractSelector,
          missingInRouter: true,
        });
      }
    }

    for (const routerSelector of this.routerSelectors) {
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
    const modulesDeploymentData = Object.values(hre.router.deployment.general.contracts).filter(
      (c) => c.isModule
    );

    const moduleAddresses = [];
    for (const {
      contractName,
      contractFullyQualifiedName,
      deployedAddress,
    } of modulesDeploymentData) {
      moduleAddresses[toPrivateConstantCase(contractName)] = {
        contractFullyQualifiedName,
        address: deployedAddress,
      };
    }

    const errors = [];

    for (const s of this.routerSelectors) {
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
          moduleAddresses[s.value.name].contractFullyQualifiedName,
          this.astNodes
        );

        if (!contractSelectors.some((cs) => cs.selector === s.selector)) {
          errors.push({
            msg: `Selector ${s.selector} not reachable. ${s.value.name} (${
              moduleAddresses[s.value.name].contractFullyQualifiedName
            }) doesn't contain a function with that selector`,
          });
        }
      }
    }

    return errors;
  }

  async findDuplicateModuleSelectors() {
    const duplicates = this.routerSelectors.map((s) => s.selector).filter(onlyRepeated);

    const errors = duplicates.map((duplicate) => ({
      msg: `Selector ${duplicate.selector} is present multiple times in the router`,
    }));

    return errors;
  }
}

module.exports = RouterASTValidator;
