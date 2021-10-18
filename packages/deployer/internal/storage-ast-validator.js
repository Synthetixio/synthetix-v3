const {
  findContractDependencies,
  findYulStorageSlotAssignments,
  findContractStateVariables,
} = require('@synthetixio/core-js/utils/ast/finders');
const { buildContractsStructMap } = require('@synthetixio/core-js/utils/ast/storage-struct');
const { compareStorageStructs } = require('@synthetixio/core-js/utils/ast/comparator');
const filterValues = require('filter-values');

class ModuleStorageASTValidator {
  constructor(asts, previousAsts) {
    this.asts = asts;
    this.previousAsts = previousAsts;
  }

  findDuplicateNamespaces(namespaces) {
    const duplicates = namespaces
      .map((s) => s.slot)
      .filter((s, index, namespaces) => namespaces.indexOf(s) !== index);

    const ocurrences = [];

    if (duplicates.length > 0) {
      duplicates.map((duplicate) => {
        const cases = namespaces.filter((s) => s.slot === duplicate);
        ocurrences.push({
          slot: duplicate,
          contracts: cases.map((c) => c.contractName),
        });
      });
    }

    return ocurrences.length > 0 ? ocurrences : null;
  }

  findNamespaceCollisions() {
    const namespaces = [];

    for (var [contractName, ast] of Object.entries(this.asts)) {
      const slots = findYulStorageSlotAssignments(contractName, ast);

      slots.forEach((slot) => namespaces.push({ contractName, slot }));
    }

    const duplicates = this.findDuplicateNamespaces(namespaces);

    const errors = [];
    if (duplicates) {
      const details = duplicates.map(
        (d) => `  > ${d.slot} found in storage contracts ${d.contracts}\n`
      );

      errors.push({
        msg: `Duplicate namespaces slot found!\n${details.join('')}`,
      });
    }

    return errors;
  }

  findNamespaceSlotChanges() {
    const previousNamespaces = [];
    const namespaces = [];
    const errors = [];

    if (!this.previousAsts) {
      return errors;
    }

    for (const [contractName, ast] of Object.entries(this.previousAsts)) {
      const slots = findYulStorageSlotAssignments(contractName, ast);

      slots.forEach((slot) => previousNamespaces.push({ contractName, slot }));
    }

    for (const [contractName, ast] of Object.entries(this.asts)) {
      const slots = findYulStorageSlotAssignments(contractName, ast);

      slots.forEach((slot) => namespaces.push({ contractName, slot }));
    }

    for (const previous of previousNamespaces) {
      const current = namespaces.find((v) => v.contractName === previous.contractName);
      if (!current) {
        errors.push({
          msg: `Removed namespaces slot! ${previous.contractName} slot ${previous.slot} not found`,
        });
        continue;
      }
      if (current.slot !== previous.slot) {
        errors.push({
          msg: `Changed namespaces slot! ${previous.contractName} slot ${previous.slot} changed to ${current.slot}`,
        });
      }
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

  async findInvalidNamespaceMutations() {
    const errors = [];

    if (!this.previousAsts) {
      return errors;
    }

    const previousStructsMap = await buildContractsStructMap(this.previousAsts);
    const currentStructsMap = await buildContractsStructMap(this.asts);

    const { modifications, removals } = compareStorageStructs({
      previousStructsMap,
      currentStructsMap,
    });

    modifications.forEach((m) => {
      if (!errors.some((e) => e.contract === m.contract && e.struct === m.struct)) {
        errors.push({
          msg: `Invalid mutation found in namespace ${m.contract}.${m.struct}`,
          contract: m.contract,
          struct: m.struct,
        });
      }
    });

    removals.forEach((m) => {
      if (!errors.some((e) => e.contract === m.contract && e.struct === m.struct)) {
        errors.push({
          msg: `Invalid mutation found in namespace ${m.contract}.${m.struct}`,
          contract: m.contract,
          struct: m.struct,
        });
      }
    });

    return errors;
  }
}

module.exports = ModuleStorageASTValidator;
