const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const {
  findContractDependencies,
  findFunctionNodes,
} = require('@synthetixio/core-js/utils/ast/finders');
const { capitalize } = require('@synthetixio/core-js/utils/misc/strings');

class ModuleInitializableASTValidator {
  constructor(
    moduleFullyQualifiedNames,
    astNodes,
    initializableMixin = '@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol:InitializableMixin'
  ) {
    this.moduleFullyQualifiedNames = moduleFullyQualifiedNames;
    this.astNodes = astNodes;
    this.initializableMixin = initializableMixin;
  }

  findMissingIsInitialized() {
    const errors = [];

    for (const contractFqName of this._findInitializableContractNames()) {
      const { contractName } = parseFullyQualifiedName(contractFqName);
      const functionName = `is${capitalize(contractName)}Initialized`;

      const hasIsInitFn = findFunctionNodes(contractFqName, this.astNodes).some(
        (v) => v.name === functionName
      );

      if (!hasIsInitFn) {
        errors.push({
          msg: `Initializable contract ${contractFqName} missing ${functionName} function!}`,
        });
      }
    }

    return errors;
  }

  findMissingInitializer() {
    const errors = [];

    for (const contractFqName of this._findInitializableContractNames()) {
      const { contractName } = parseFullyQualifiedName(contractFqName);
      const functionName = `initialize${capitalize(contractName)}`;

      const hasInitializableFn = findFunctionNodes(contractFqName, this.astNodes).some(
        (v) => v.name === functionName
      );

      if (!hasInitializableFn) {
        errors.push({
          msg: `Initializable contract ${contractFqName} missing ${functionName} function!}`,
        });
      }
    }

    return errors;
  }

  _findInitializableContractNames() {
    return this.moduleFullyQualifiedNames
      .filter((contractFqName) => contractFqName !== this.initializableMixin)
      .filter((contractFqName) =>
        findContractDependencies(contractFqName, this.astNodes).includes(this.initializableMixin)
      );
  }
}

module.exports = ModuleInitializableASTValidator;
