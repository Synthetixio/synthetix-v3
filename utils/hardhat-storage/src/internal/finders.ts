import * as parser from '@solidity-parser/parser';

import type {
  ASTNode,
  ASTNodeTypeString,
  ContractDefinition,
  SourceUnit,
} from '@solidity-parser/parser/src/ast-types';

type ASTMap<U> = { [K in ASTNodeTypeString]: U extends { type: K } ? U : never };
type ASTTypeMap = ASTMap<ASTNode>;

// parse.visit() function but compatible with multiple astNodes and better types interface
function _visit<T extends ASTNodeTypeString>(
  astNodes: ASTNode | ASTNode[],
  nodeTypes: T | T[],
  visitorFn: (node: ASTTypeMap[T]) => false | void
) {
  let cancelled = false;
  const visitor = {} as any;

  const astNodesArr = Array.isArray(astNodes) ? astNodes : [astNodes];
  const nodeTypesArr = Array.isArray(nodeTypes) ? nodeTypes : [nodeTypes];

  const _visitorFn = (node: ASTTypeMap[T]) => {
    const res = visitorFn(node);
    if (res === false) cancelled = true;
  };

  for (const nodeType of nodeTypesArr) {
    visitor[nodeType] = _visitorFn;
  }

  for (const astNode of astNodesArr) {
    if (cancelled) break;
    parser.visit(astNode, visitor);
  }
}

export function findAll<T extends ASTNodeTypeString>(
  astNodes: ASTNode | ASTNode[],
  nodeTypes: T | T[],
  filterFn: (node: ASTTypeMap[T]) => boolean = () => true
) {
  let results: ASTTypeMap[T][] = [];

  _visit(astNodes, nodeTypes, (node) => {
    if (filterFn(node)) results.push(node);
  });

  return results;
}

export function findOne<T extends ASTNodeTypeString>(
  astNodes: ASTNode | ASTNode[],
  nodeTypes: T | T[],
  filterFn: (node: ASTTypeMap[T]) => boolean = () => true
): ASTTypeMap[T] | undefined {
  let result: ASTTypeMap[T] | undefined = undefined;

  _visit(astNodes, nodeTypes, (node) => {
    if (filterFn(node)) {
      result = node;
      return false;
    }
  });

  return result;
}

export function findContract(astNode: SourceUnit, contractName: string) {
  return astNode.children.find(
    (node) => node.type === 'ContractDefinition' && node.name === contractName
  ) as ContractDefinition | undefined;
}

export function findContractStrict(astNode: SourceUnit, contractName: string) {
  const contractNode = findContract(astNode, contractName);

  if (!contractNode) {
    throw new Error(`Contract with name "${contractName}" not found`);
  }

  return contractNode;
}

export function getCanonicalImportedSymbolName(astNode: ASTNode, symbolName: string) {
  for (const imp of findAll(astNode, 'ImportDirective')) {
    if (imp.symbolAliases) {
      for (const [canonicalName, alias] of imp.symbolAliases) {
        if (canonicalName === symbolName || alias === symbolName) {
          return [imp.path, canonicalName];
        }
      }
    }
  }
}
