const {
  findContractDefinitions,
  findContractDependencies,
  findYulStorageSlotAssignments,
  findContractStateVariables,
  findContractNode,
} = require('@synthetixio/core-js/utils/ast/finders');
const { onlyUnique } = require('@synthetixio/core-js/utils/misc/array-filters');
const { buildContractsStructMap } = require('@synthetixio/core-js/utils/ast/storage-struct');
const { compareStorageStructs } = require('@synthetixio/core-js/utils/ast/comparator');
const { onlyRepeated } = require('@synthetixio/core-js/utils/misc/array-filters');

class ModuleStorageASTValidator {
  constructor(moduleFullyQualifiedNames, astNodes, previousAstNodes = {}) {
    this.moduleFullyQualifiedNames = moduleFullyQualifiedNames;
    this.astNodes = astNodes;
    this.contractNodes = this.astNodes.flatMap(findContractDefinitions);
    this.previousContractNodes = previousAstNodes.flatMap(findContractDefinitions);
  }

  findNamespaceCollisions() {
    const namespaces = [];
    const errors = [];

    for (const contractNode of this.contractNodes) {
      for (const slot of findYulStorageSlotAssignments(contractNode)) {
        namespaces.push({ contractName: contractNode.name, slot });
      }
    }

    const duplicates = this._findDuplicateNamespaces(namespaces);

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

  _findDuplicateNamespaces(namespaces) {
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

  findNamespaceSlotChanges() {
    const previousNamespaces = [];
    const namespaces = [];
    const errors = [];

    if (this.previousContractNodes.length === 0) {
      return errors;
    }

    for (const contractNode of this.previousContractNodes) {
      for (const slot of findYulStorageSlotAssignments(contractNode)) {
        previousNamespaces.push({ contractName: contractNode.name, slot });
      }
    }

    for (const contractNode of this.contractNodes) {
      for (const slot of findYulStorageSlotAssignments(contractNode)) {
        namespaces.push({ contractName: contractNode.name, slot });
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

    // Find all contracts inherted by modules
    const candidateNodes = this.moduleFullyQualifiedNames
      .flatMap((fqName) => findContractDependencies(fqName, this.astNodes))
      .filter(onlyUnique)
      .map((fqName) => findContractNode(fqName, this.astNodes));

    // Look for state variable declarations
    for (const contractNode of candidateNodes) {
      for (const node of findContractStateVariables(contractNode)) {
        if (node.mutability === 'constant' || node.mutability === 'immutable') {
          continue;
        }

        errors.push({
          msg: `Unsafe state variable declaration in ${contractNode.name}: "${node.typeName.name} ${node.name}"`,
        });
      }
    }

    return errors;
  }

  async findInvalidNamespaceMutations() {
    const errors = [];

    if (this.previousContractNodes.length === 0) {
      return errors;
    }

    const previousStructsMap = await buildContractsStructMap(this.previousContractNodes);
    const currentStructsMap = await buildContractsStructMap(this.contractNodes);

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
