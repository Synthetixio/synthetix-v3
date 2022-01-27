const {
  findContractDefinitions,
  findContractDependencies,
  findFunctions,
} = require('@synthetixio/core-js/utils/ast/finders');
const { contractIsModule } = require('../internal/contract-helper');

class InterfaceCoverageASTValidator {
  constructor(asts, isModuleChecker = contractIsModule) {
    this.contractNodes = asts.map(findContractDefinitions).flat();
    this.moduleNodes = asts
      .filter((v) => isModuleChecker(v.absolutePath))
      .map(findContractDefinitions)
      .flat();
  }

  findFunctionsNotDefinedInInterfaces() {
    const errors = [];

    for (const module of this.moduleNodes) {
      const visibleFunctions = this._findVisibleFunctions(module);

      if (visibleFunctions.length === 0) {
        continue;
      }

      const interfacedFunctions = this._findInterfaceFunctions(module);

      for (const visibleFunction of visibleFunctions) {
        if (
          !interfacedFunctions.some((f) => f.functionSelector === visibleFunction.functionSelector)
        ) {
          errors.push({
            msg: `Visible function ${visibleFunction.name} of contract ${module.name} not found in the inherited interfaces`,
          });
        }
      }
    }

    return errors;
  }

  _findVisibleFunctions(module) {
    const visibleFunctions = findFunctions(module.name, this.contractNodes)
      .filter((f) => f.visibility === 'public' || f.visibility === 'external')
      .filter((f) => !f.name.startsWith('c_0x')); // Filter out coverage added functions

    return visibleFunctions;
  }

  _findInterfaceFunctions(module) {
    const interfacedFunctions = [];

    for (const dependency of findContractDependencies(module.name, this.contractNodes)) {
      if (dependency.contractKind != 'interface') {
        continue;
      }

      interfacedFunctions.push(...findFunctions(dependency.name, this.contractNodes));
    }

    return interfacedFunctions;
  }
}

module.exports = InterfaceCoverageASTValidator;
