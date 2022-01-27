const {
  findContractDefinitions,
  findContractDependencies,
  findFunctions,
} = require('@synthetixio/core-js/utils/ast/finders');
const { capitalize } = require('@synthetixio/core-js/utils/misc/strings');

class ModuleInitializableASTValidator {
  constructor(asts) {
    this.contractNodes = asts.map(findContractDefinitions).flat();
  }

  findMissingIsInitialized() {
    const errors = [];

    for (const contractName of this.findInitializableContractNames()) {
      const functionName = `is${capitalize(contractName)}Initialized`;

      if (!findFunctions(contractName, this.contractNodes).some((v) => v.name === functionName)) {
        errors.push({
          msg: `Initializable contract ${contractName} missing ${functionName} function!}`,
        });
      }
    }

    return errors;
  }

  findMissingInitializer() {
    const errors = [];

    for (const contractName of this.findInitializableContractNames()) {
      const functionName = `initialize${capitalize(contractName)}`;

      if (!findFunctions(contractName, this.contractNodes).some((v) => v.name === functionName)) {
        errors.push({
          msg: `Initializable contract ${contractName} missing ${functionName} function!}`,
        });
      }
    }

    return errors;
  }

  findInitializableContractNames() {
    const initializableContractNames = [];

    const contractNames = this.contractNodes.map((v) => v.name);

    for (const contractName of contractNames) {
      if (contractName === 'InitializableMixin') {
        continue;
      }

      if (
        findContractDependencies(contractName, this.contractNodes).some(
          (v) => v.name === 'InitializableMixin'
        )
      ) {
        initializableContractNames.push(contractName);
      }
    }

    return initializableContractNames;
  }
}

module.exports = ModuleInitializableASTValidator;
