const {
  findContractDependencies,
  findYulStorageSlotAssignments,
  findDuplicateSlots,
  findContractStateVariables,
} = require('@synthetixio/core-js/utils/ast');
const logger = require('@synthetixio/core-js/utils/logger');
const filterValues = require('filter-values');

class ModuleStorageASTValidator {
  constructor(asts) {
    this.asts = asts;
  }

  findDuplicateNamespaces(namespaces) {
    const duplicates = namespaces
      .map((s) => s.position)
      .filter((s, index, namespaces) => namespaces.indexOf(s) !== index);

    const ocurrences = [];

    if (duplicates.length > 0) {
      duplicates.map((duplicate) => {
        const cases = namespaces.filter((s) => s.position === duplicate);
        ocurrences.push({
          position: duplicate,
          contracts: cases.map((c) => c.contractName),
        });
      });
    }

    return ocurrences.length > 0 ? ocurrences : null;
  }

  findNamespaceCollisions() {
    const namespaces = [];

    for (var [contractName, ast] of Object.entries(this.asts)) {
      const slot = findYulStorageSlotAssignments(contractName, ast);

      if (slot) {
        slot.forEach((position) => namespaces.push({ contractName, position }));
      }
    }

    const duplicates = this.findDuplicateNamespaces(namespaces);

    const errors = [];
    if (duplicates) {
      const details = duplicates.map(
        (d) => `  > ${d.position} found in storage contracts ${d.contracts}\n`
      );

      errors.push({
        msg: `Duplicate namespaces found!\n${details.join('')}`,
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
      const deps = findContractDependencies(moduleName, this.asts).map((dep) => dep.name);
      deps.forEach((dep) => {
        if (!candidates.includes(dep)) {
          candidates.push(dep);
        }
      });
    }

    // Look for state variable declarations
    candidates.forEach((contractName) => {
      const vars = findContractStateVariables(contractName, this.asts[contractName]);
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
