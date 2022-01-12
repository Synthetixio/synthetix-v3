const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const {
  findContractDefinitions,
  findContractDependencies,
  findFunctions,
} = require('@synthetixio/core-js/utils/ast/finders');
const filterValues = require('filter-values');

class ModuleInitializableASTValidator {
  constructor(asts) {
    this.contractNodes = Object.values(asts).map(findContractDefinitions).flat();
  }

  findMissingIsInitialized() {
    const errors = [];

    for (const contractName of this.findInitializableContractNames()) {
      const functionName = `is${_capitalizeContractName(contractName)}Initialized`;
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
      const functionName = `initialize${_capitalizeContractName(contractName)}`;
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
  
    // const moduleNames = Object.keys(
    //   filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule)
    // );
    const contractNames =  this.contractNodes.map((v) => v.name);

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

function _capitalizeContractName(contractName) {
  return contractName.charAt(0).toUpperCase() + contractName.slice(1);
}


module.exports = ModuleInitializableASTValidator;
