const {
  findContractDependencies,
  findYulStorageSlotAssignments,
  findContractStateVariables,
} = require('@synthetixio/core-js/utils/ast/finders');
const { buildContractsStructMap } = require('@synthetixio/core-js/utils/ast/storage-struct');
const { compareStorageStructs } = require('@synthetixio/core-js/utils/ast/comparator');
const filterValues = require('filter-values');
const { onlyRepeated } = require('@synthetixio/core-js/utils/misc/array-filters');

class ModuleStorageASTValidator {
  constructor(asts, previousAsts) {
    this.asts = asts;
    this.previousAsts = previousAsts;
  }

  findDuplicateNamespaces(namespaces) {
    const duplicates = namespaces.map((namespace) => namespace.slot).filter(onlyRepeated);

    const ocurrences = [];

    for (const duplicate of duplicates) {
      const contracts = namespaces.filter((s) => s.slot === duplicate).map((c) => c.contractName);
      ocurrences.push({
        slot: duplicate,
        contracts,
      });
    }

    return ocurrences.length > 0 ? ocurrences : null;
  }

  findNamespaceCollisions() {
    const namespaces = [];
    const errors = [];

    for (const [contractName, ast] of Object.entries(this.asts)) {
      for (const slot of findYulStorageSlotAssignments(contractName, ast)) {
        namespaces.push({ contractName, slot });
      }
    }

    const duplicates = this.findDuplicateNamespaces(namespaces);

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
      for (const slot of findYulStorageSlotAssignments(contractName, ast)) {
        previousNamespaces.push({ contractName, slot });
      }
    }

    for (const [contractName, ast] of Object.entries(this.asts)) {
      for (const slot of findYulStorageSlotAssignments(contractName, ast)) {
        namespaces.push({ contractName, slot });
      }
    }

    for (const previous of previousNamespaces) {
      const current = namespaces.find((v) => v.contractName === previous.contractName);

      if (!current) {
        errors.push({
          msg: `Storage namespace removed! ${previous.contractName} slot ${previous.slot} not found`,
        });

        continue;
      }

      if (current.slot !== previous.slot) {
        errors.push({
          msg: `Storage namespace hash changed! ${previous.contractName} slot ${previous.slot} changed to ${current.slot}`,
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
      for (const dep of findContractDependencies(moduleName, this.asts)) {
        if (!candidates.includes(dep.name)) {
          candidates.push(dep.name);
        }
      }
    }

    // Look for state variable declarations
    for (const contractName of candidates) {
      for (const node of findContractStateVariables(contractName, this.asts[contractName])) {
        errors.push({
          msg: `Unsafe state variable declaration in ${contractName}: "${node.typeName.name} ${node.name}"`,
        });
      }
    }

    return errors;
  }

  async findInvalidNamespaceMutations() {
    const errors = [];

    if (!this.previousAsts) {
      return errors;
    }

    const previousStructsMap = await buildContractsStructMap(this.previousAsts);
    const currentStructsMap = await buildContractsStructMap(this.asts);

    let { modifications, removals } = compareStorageStructs({
      previousStructsMap,
      currentStructsMap,
    });

    removals = removals.filter((removal) => removal.completeStruct === false);

    for (const m of modifications) {
      const alreadyReported = errors.some(
        (e) => e.contract === m.contract && e.struct === m.struct
      );

      if (!alreadyReported) {
        errors.push({
          msg: `Invalid modification mutation found in namespace ${m.contract}.${m.struct}`,
          contract: m.contract,
          struct: m.struct,
        });
      }
    }

    for (const m of removals) {
      const alreadyReported = errors.some(
        (e) => e.contract === m.contract && e.struct === m.struct
      );

      if (!alreadyReported) {
        errors.push({
          msg: `Invalid removal mutation found in namespace ${m.contract}.${m.struct}`,
          contract: m.contract,
          struct: m.struct,
        });
      }
    }

    return errors;
  }
}

module.exports = ModuleStorageASTValidator;
