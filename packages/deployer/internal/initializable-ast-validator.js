const {
  findContractDefinitions,
  findContractDependencies,
  findFunctions,
} = require('@synthetixio/core-js/utils/ast/finders');
const { contractIsModule } = require('../internal/contract-helper');
const { capitalize } = require('@synthetixio/core-js/utils/misc/strings');

class ModuleInitializableASTValidator {
  constructor(asts, isModuleChecker = contractIsModule) {
    this.moduleNodes = Object.values(asts)
      .filter((v) => isModuleChecker(v.absolutePath))
      .map(findContractDefinitions)
      .flat();
    this.contractNodes = Object.values(asts).map(findContractDefinitions).flat();
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
    const initializableModuleNames = [];

    const moduleNames = this.moduleNodes.map((v) => v.name);

    for (const moduleName of moduleNames) {
      if (moduleName === 'InitializableMixin') {
        continue;
      }

      if (
        findContractDependencies(moduleName, this.contractNodes).some(
          (v) => v.name === 'InitializableMixin'
        )
      ) {
        initializableModuleNames.push(moduleName);
      }
    }

    return initializableModuleNames;
  }
}

module.exports = ModuleInitializableASTValidator;
