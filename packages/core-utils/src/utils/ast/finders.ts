import { ContractDefinition, SourceUnit, StructDefinition } from 'solidity-ast';
import { Node } from 'solidity-ast/node';
import { findAll } from 'solidity-ast/utils';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';

/**
 * Get all the contract definitions on the given node
 * @param {import("solidity-ast").SourceUnit} astNode
 * @returns {import("solidity-ast").ContractDefinition[]}
 */
export function findContractDefinitions(astNode: SourceUnit) {
  return Array.from(findAll('ContractDefinition', astNode));
}

/**
 * Get the given contract by name on the given AST
 * @param {string} contractName
 * @param {import("solidity-ast").SourceUnit|import("solidity-ast").SourceUnit} sourceUnitNode
 * @returns {import("solidity-ast").ContractDefinition}
 */
export function _findContractNodeWithName(contractName: string, sourceUnitNode: SourceUnit) {
  for (const contractDefiniton of findAll('ContractDefinition', sourceUnitNode)) {
    if (contractDefiniton.name === contractName) {
      return contractDefiniton;
    }
  }
}

/**
 * Get all the variable nodes defined on a contract node
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {import("solidity-ast").VariableDeclaration}
 */
export function findContractNodeVariables(contractNode: StructDefinition) {
  return Array.from(findAll('VariableDeclaration', contractNode));
}

/**
 * Get all the structs definitions on a contract node
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {import("solidity-ast").StructDefinition}
 */
export function findContractNodeStructs(contractNode: ContractDefinition) {
  return Array.from(findAll('StructDefinition', contractNode));
}

/**
 * Get the state variables from the given contract name
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {import("solidity-ast").VariableDeclaration}
 */
export function findContractStateVariables(contractNode: StructDefinition) {
  return findContractNodeVariables(contractNode).filter((n) => n.stateVariable);
}

/**
 * Find all the slot definitions on the given AST node
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {string[]}
 */
export function findYulStorageSlotAssignments(contractNode: ContractDefinition) {
  return Array.from(findAll('YulAssignment', contractNode))
    .filter((assignment) => assignment.variableNames[0].name.endsWith('.slot'))
    .map((assignment) => (assignment.value as any).value); // TODO
}

/**
 * Get all the case values from the given contract node
 * @param {string} contractName
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {{ selector: string, value?: string }[]}
 */
export function findYulCaseValues(contractNode: StructDefinition) {
  const addressVariables = findContractNodeVariables(contractNode);

  const items = [];
  for (const caseSelector of findAll('YulCase', contractNode)) {
    if (caseSelector.value === 'default') continue;
    if (caseSelector.value.value === '0') continue;

    const caseAssignment = findAll('YulAssignment', caseSelector);
    const nextCaseAssignment = caseAssignment.next();

    items.push({
      selector: caseSelector.value.value,
      value: addressVariables.find((v) => v.name === nextCaseAssignment.value.value.name),
    });
  }

  return items;
}

function _findFunctionSelectors(contractNode: ContractDefinition) {
  const selectors = [];

  for (const functionDefinition of findAll('FunctionDefinition', contractNode)) {
    if (functionDefinition.functionSelector) {
      selectors.push({ selector: '0x' + functionDefinition.functionSelector });
    }
  }

  return selectors;
}

/**
 * Get the complete tree of dependencies from the given contract. This method recursevely
 * finds the inherited contracts following variable references.
 * @param contractFullyQualifiedName
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {string[]}
 */
export function findContractDependencies(
  contractFullyQualifiedName: string,
  astNodes: SourceUnit[]
): string[] {
  const { sourceUnitNode, contractNode } = _findContractSourceByFullyQualifiedName(
    contractFullyQualifiedName,
    astNodes
  );

  if (!contractNode) {
    return [];
  }

  const inheritedCotractsFullyQualifiedNames = _findInheritedContractsLocalNodeNames(
    contractNode,
    sourceUnitNode
  ).map((localContractName) =>
    localContractName
      ? _findLocalContractFullyQualifiedName(localContractName, sourceUnitNode, astNodes)
      : null
  );

  return [
    contractFullyQualifiedName,
    ...inheritedCotractsFullyQualifiedNames.flatMap((inheritedContractFullyQualifiedName) =>
      inheritedContractFullyQualifiedName
        ? findContractDependencies(inheritedContractFullyQualifiedName, astNodes)
        : []
    ),
  ].flat();
}

function _findSourceUnitByAbsolutePath(absolutePath: string, astNodes: SourceUnit[]) {
  for (const astNode of astNodes) {
    for (const sourceUnitNode of findAll('SourceUnit', astNode)) {
      if (sourceUnitNode.absolutePath === absolutePath) {
        return sourceUnitNode;
      }
    }
  }
}

function _findContractSourceByFullyQualifiedName(
  contractFullyQualifiedName: string,
  astNodes: SourceUnit[]
) {
  const { sourceName, contractName } = parseFullyQualifiedName(contractFullyQualifiedName);
  const sourceUnitNode = _findSourceUnitByAbsolutePath(sourceName, astNodes);
  if (!sourceUnitNode) return {};
  const contractNode = _findContractNodeWithName(contractName, sourceUnitNode);
  if (!contractNode) return {};
  return { sourceUnitNode, contractNode };
}

function _findInheritedContractsLocalNodeNames(contractNode: Node, sourceUnitNode: SourceUnit) {
  return Array.from(findAll('InheritanceSpecifier', contractNode))
    .map((inheritNode) => inheritNode.baseName.referencedDeclaration)
    .map(
      (declarationId) =>
        (Object.entries(sourceUnitNode.exportedSymbols).find(([, ids]) =>
          (ids || []).includes(declarationId)
        ) || [null])[0]
    );
}

function _findLocalContractFullyQualifiedName(
  localContractName: string,
  localSourceUnitNode: SourceUnit,
  astNodes: SourceUnit[]
) {
  // First, check if the contract was created locally
  const localContractNode = _findContractNodeWithName(localContractName, localSourceUnitNode);
  if (localContractNode) {
    return `${localSourceUnitNode.absolutePath}:${localContractName}`;
  }

  // If not, look it on the imports
  return findImportedContractFullyQualifiedName(localContractName, localSourceUnitNode, astNodes);
}

/**
 * Find a contracts node on the ASTs trees.
 * @param {string} contractFullyQualifiedName
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {string[]}
 */
export function findContractNode(contractFullyQualifiedName: string, astNodes: SourceUnit[]) {
  const { contractNode } = _findContractSourceByFullyQualifiedName(
    contractFullyQualifiedName,
    astNodes
  );

  return contractNode;
}

/**
 * Get the fully qualified name of a local contract on a given AST node. Takes
 * into account any possible aliases given to it during import.
 * @param {string} localContractName The name given locally to the contract on baseAstNode
 * @param {import("solidity-ast").SourceUnit} baseAstNode The AST node of the solidity file.
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {string}
 */
export function findImportedContractFullyQualifiedName(
  localContractName: string,
  baseAstNode: SourceUnit,
  astNodes: SourceUnit[]
) {
  for (const importNode of findAll('ImportDirective', baseAstNode)) {
    const contractSource = importNode.absolutePath;

    if (importNode.symbolAliases.length > 0) {
      const alias = importNode.symbolAliases.find((alias) => alias.local === localContractName);

      if (alias) {
        return `${contractSource}:${alias.foreign.name}`;
      }
    }

    const importedSourceNode = _findSourceUnitByAbsolutePath(importNode.absolutePath, astNodes);

    if (!importedSourceNode) {
      return null;
    }

    const importedContractNodes = Array.from(findAll('ContractDefinition', importedSourceNode));
    const importedContract = importedContractNodes.find(({ name }) => name === localContractName);

    if (importedContract) {
      return `${contractSource}:${importedContract.name}`;
    }
  }
}

/**
 * Get all the function selectors definitions from the complete tree of contract
 * nodes starting from the given root contract definition
 * @param {string} contractFullyQualifiedName
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {import("solidity-ast").ContractDefinition[]}
 */
export function findFunctionSelectors(contractFullyQualifiedName: string, astNodes: SourceUnit[]) {
  const selectors = [];

  for (const contractFqName of findContractDependencies(contractFullyQualifiedName, astNodes)) {
    const contractNode = findContractNode(contractFqName, astNodes);

    if (!contractNode) {
      continue;
    }

    const currentSelectors = _findFunctionSelectors(contractNode);
    if (currentSelectors.length > 0) {
      selectors.push(...currentSelectors);
    }
  }

  return selectors;
}

/**
 * Get all the function definitions from the complete tree of contract
 * nodes starting from the given root contract definition
 * @param {string} contractFullyQualifiedName
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {import("solidity-ast").FunctionDefinition[]}
 */
export function findFunctionNodes(contractFullyQualifiedName: string, astNodes: SourceUnit[]) {
  return findContractDependencies(contractFullyQualifiedName, astNodes).flatMap(
    (contractFullyQualifiedName) => {
      const { contractNode } = _findContractSourceByFullyQualifiedName(
        contractFullyQualifiedName,
        astNodes
      );

      if (!contractNode) {
        return [];
      }

      return Array.from(findAll('FunctionDefinition', contractNode));
    }
  );
}
