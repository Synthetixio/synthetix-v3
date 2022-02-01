const {
  findContractDefinitions,
  contractHasDependency,
  findFunctions,
} = require('@synthetixio/core-js/utils/ast/finders');
const { contractIsModule } = require('../internal/contract-helper');
const { capitalize } = require('@synthetixio/core-js/utils/misc/strings');

class ModuleInitializableASTValidator {
  constructor(astNodes, isModuleChecker = contractIsModule) {
    this.moduleNodes = astNodes
      .filter((v) => isModuleChecker(v.absolutePath))
      .flatMap(findContractDefinitions);
    this.contractNodes = astNodes.flatMap(findContractDefinitions);
  }

  findMissingIsInitialized() {
    const errors = [];

    for (const moduleName of this.findInitializableModuleNames()) {
      const functionName = `is${capitalize(moduleName)}Initialized`;

      if (!findFunctions(moduleName, this.contractNodes).some((v) => v.name === functionName)) {
        errors.push({
          msg: `Initializable module ${moduleName} missing ${functionName} function!`,
        });
      }
    }

    return errors;
  }

  findMissingInitializer() {
    const errors = [];

    for (const moduleName of this.findInitializableModuleNames()) {
      const functionName = `initialize${capitalize(moduleName)}`;

      if (!findFunctions(moduleName, this.contractNodes).some((v) => v.name === functionName)) {
        errors.push({
          msg: `Initializable module ${moduleName} missing ${functionName} function!`,
        });
      }
    }

    return errors;
  }

  findInitializableModuleNames() {
    return this.moduleNodes
      .map((v) => v.name)
      .filter((contractName) => contractName !== 'InitializableMixin')
      .filter((contractName) =>
        contractHasDependency(contractName, 'InitializableMixin', this.moduleNodes)
      );
  }
}

module.exports = ModuleInitializableASTValidator;
