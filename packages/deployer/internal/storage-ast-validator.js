const {
  findDependenciesOf,
  getSlotAddresses,
  findDuplicateSlots,
  findStateVariables,
} = require('@synthetixio/core-js/utils/ast');
const logger = require('@synthetixio/core-js/utils/logger');
const filterValues = require('filter-values');

class ModuleStorageASTValidator {
  constructor(asts) {
    this.asts = asts;
  }

  findNamespaceCollisions() {
    const slots = [];
    for (var [contractName, ast] of Object.entries(this.asts)) {
      const slotAddresses = getSlotAddresses(contractName, ast);
      if (slotAddresses) {
        slotAddresses.forEach((address) => slots.push({ contractName, address }));
      }
    }
    const duplicates = findDuplicateSlots(slots);

    const errors = [];
    if (duplicates) {
      const details = duplicates.map(
        (d) => `  > ${d.address} found in storage contracts ${d.contracts}\n`
      );

      errors.push({
        msg: `Duplicate Namespaces found!\n${details.join('')}`,
      });
    }

    return errors;
  }

  findRegularVariableDeclarations() {
    const errors = [];

    const moduleNames = Object.keys(
      filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule)
    );

    // Find all contracts inherted by modules
    const candidates = [];
    for (const moduleName of moduleNames) {
      const deps = findDependenciesOf(moduleName, this.asts).map((dep) => dep.name);
      deps.forEach((dep) => {
        if (!candidates.includes(dep)) {
          candidates.push(dep);
        }
      });
    }

    // Look for state variable declarations
    candidates.forEach((contractName) => {
      const vars = findStateVariables(contractName, this.asts[contractName]);
      if (vars) {
        vars.forEach((node) => {
          errors.push({
            msg: `Unsafe state variable declaration in ${contractName}: "${node.typeName.name} ${node.name}"`,
          });
        });
      }
    });

    return errors;
  }

  findInvalidNamespaceMutations() {
    logger.info(
      'Unsafe storage namespace mutations are not yet validated in modules. Please only append to storage namespace structs.'
    );

    return [];
  }
}

module.exports = ModuleStorageASTValidator;
