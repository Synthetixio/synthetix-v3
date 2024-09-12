import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { ContractDefinition, SourceUnit, StructDefinition } from 'solidity-ast';
import {
  Node,
  NodeType,
  NodeTypeMap,
  YulNode,
  YulNodeType,
  YulNodeTypeMap,
} from 'solidity-ast/node';
import { findAll as _findAll } from 'solidity-ast/utils';

/**
 * Get all the contract definitions on the given node
 */
export function findAll<T extends NodeType | YulNodeType>(
  astNode: Node | YulNode | (Node | YulNode)[],
  nodeType: T | T[],
  filterFn: (node: (NodeTypeMap & YulNodeTypeMap)[T]) => boolean = () => true
) {
  const result: (NodeTypeMap & YulNodeTypeMap)[T][] = [];

  if (Array.isArray(astNode)) {
    for (const node of astNode) {
      result.push(...findAll(node, nodeType, filterFn));
    }

    return result;
  }

  for (const node of _findAll(nodeType, astNode)) {
    if (filterFn(node)) result.push(node);
  }

  return result;
}

export function findOne<T extends NodeType | YulNodeType>(
  astNode: Node | YulNode | (Node | YulNode)[],
  nodeType: T | T[],
  filterFn: (node: (NodeTypeMap & YulNodeTypeMap)[T]) => boolean = () => true
) {
  if (Array.isArray(astNode)) {
    for (const node of astNode) {
      const result = findOne(node, nodeType, filterFn) as (NodeTypeMap & YulNodeTypeMap)[T];
      if (result) return result;
    }
  } else {
    for (const node of _findAll(nodeType, astNode)) {
      if (filterFn(node)) return node;
    }
  }
}

export function findOneById<T extends NodeType | YulNodeType>(
  astNode: Node | YulNode | (Node | YulNode)[],
  nodeType: T | T[],
  nodeId: number,
  filterFn: (node: (NodeTypeMap & YulNodeTypeMap)[T]) => boolean = () => true
) {
  const result = findOne(
    astNode,
    nodeType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node) => typeof (node as any).id === 'number' && (node as any).id === nodeId && filterFn(node)
  );

  if (!result) throw new Error(`Could not find node with id "${nodeId}"`);

  return result;
}

// Helper function to find nodes as direct children in a SourceUnit,
// Using this function you can avoid having to loop the whole tree when you know
// where are you looking for stuff
export function findChildren<T extends NodeType | YulNodeType>(
  sourceUnit: SourceUnit,
  nodeType: T,
  filterFn: (node: SourceUnit['nodes'][number]) => boolean = () => true
) {
  return sourceUnit.nodes.filter(
    (node) => node.nodeType === nodeType && filterFn(node)
  ) as (NodeTypeMap & YulNodeTypeMap)[T][];
}

/**
 * Get all the contract definitions on the given node
 */
export function findContractDefinitions(astNode: SourceUnit) {
  return findAll(astNode, 'ContractDefinition');
}

/**
 * Get the given contract by name on the given AST
 */
function _findContractNodeWithName(contractName: string, astNode: SourceUnit) {
  for (const contractDefiniton of findAll(astNode, 'ContractDefinition')) {
    if (contractDefiniton.name === contractName) {
      return contractDefiniton;
    }
  }
}

/**
 * Get all the variable nodes defined on a contract node
 */
export function findContractNodeVariables(contractNode: StructDefinition) {
  return findAll(contractNode, 'VariableDeclaration');
}

/**
 * Get all the structs definitions on a contract node
 */
export function findContractNodeStructs(contractNode: ContractDefinition) {
  return findAll(contractNode, 'StructDefinition');
}

/**
 * Get the state variables from the given contract name
 */
export function findContractStateVariables(contractNode: StructDefinition) {
  return findContractNodeVariables(contractNode).filter((n) => n.stateVariable);
}

/**
 * Find all the slot definitions on the given AST node
 */
export function findYulStorageSlotAssignments(contractNode: ContractDefinition) {
  return findAll(contractNode, 'YulAssignment')
    .filter((assignment) => assignment.variableNames[0].name.endsWith('.slot'))
    .map((assignment) => (assignment.value as { value?: unknown }).value); // TODO
}

function _findFunctionSelectors(contractNode: ContractDefinition) {
  const selectors = [];

  for (const functionDefinition of findAll(contractNode, 'FunctionDefinition')) {
    if (functionDefinition.functionSelector) {
      selectors.push({ selector: '0x' + functionDefinition.functionSelector });
    }
  }

  return selectors;
}

/**
 * Get the complete tree of dependencies from the given contract. This method recursevely
 * finds the inherited contracts following variable references.
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
    for (const sourceUnitNode of findAll(astNode, 'SourceUnit')) {
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
  return findAll(contractNode, 'InheritanceSpecifier')
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
 */
export function findContractNode(contractFullyQualifiedName: string, astNodes: SourceUnit[]) {
  const { contractNode } = _findContractSourceByFullyQualifiedName(
    contractFullyQualifiedName,
    astNodes
  );

  return contractNode;
}

/**
 * Find a contracts node on the ASTs trees, and returns both
 */
export function findContractNodeWithAst(
  contractFullyQualifiedName: string,
  astNodes: SourceUnit[]
): [SourceUnit, ContractDefinition] {
  const { contractNode, sourceUnitNode } = _findContractSourceByFullyQualifiedName(
    contractFullyQualifiedName,
    astNodes
  );

  if (!contractNode) {
    throw new Error(`Could not find contract node for "${contractFullyQualifiedName}"`);
  }

  return [sourceUnitNode, contractNode];
}

/**
 * Get the fully qualified name of a local contract on a given AST node. Takes
 * into account any possible aliases given to it during import.
 */
export function findImportedContractFullyQualifiedName(
  localContractName: string,
  baseAstNode: SourceUnit,
  astNodes: SourceUnit[]
) {
  for (const importNode of findAll(baseAstNode, 'ImportDirective')) {
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

    const importedContractNodes = findAll(importedSourceNode, 'ContractDefinition');
    const importedContract = importedContractNodes.find(({ name }) => name === localContractName);

    if (importedContract) {
      return `${contractSource}:${importedContract.name}`;
    }
  }
}

/**
 * Get all the function selectors definitions from the complete tree of contract
 * nodes starting from the given root contract definition
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
 * nodes starting from the given root contract definition.
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

      return findAll(contractNode, 'FunctionDefinition');
    }
  );
}

export function findImportsRecursive(sourceName: string, allSourceUnits: SourceUnit[]) {
  const result = new Set<string>();
  _addImportsRecursive(result, sourceName, allSourceUnits);
  return Array.from(result);
}

// Find imports, but infinite recursion safe
function _addImportsRecursive(
  result: Set<string>,
  sourceName: string,
  allSourceUnits: SourceUnit[]
) {
  if (result.has(sourceName)) return;

  result.add(sourceName);

  const sourceUnit = allSourceUnits.find((s) => s.absolutePath === sourceName)!;

  if (!sourceUnit) throw new Error(`Missing source unit for ${sourceName}`);

  const importedSources = findChildren(sourceUnit, 'ImportDirective').map((d) => d.absolutePath);

  for (const s of importedSources) {
    _addImportsRecursive(result, s, allSourceUnits);
  }
}
