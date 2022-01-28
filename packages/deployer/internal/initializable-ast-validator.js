const {
  findContractDefinitions,
  contractHasDependency,
  findFunctions,
} = require('@synthetixio/core-js/utils/ast/finders');
const { capitalize } = require('@synthetixio/core-js/utils/misc/strings');

class ModuleInitializableASTValidator {
  constructor(astNodes) {
    this.contractNodes = astNodes.flatMap(findContractDefinitions);
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
    return this.contractNodes
      .map((v) => v.name)
      .filter((contractName) => contractName !== 'InitializableMixin')
      .filter((contractName) =>
        contractHasDependency(contractName, 'InitializableMixin', this.contractNodes)
      );
  }
}

module.exports = ModuleInitializableASTValidator;
