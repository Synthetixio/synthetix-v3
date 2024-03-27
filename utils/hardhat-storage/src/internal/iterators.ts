import { findAll } from '@synthetixio/core-utils/utils/ast/finders';
import {
  ContractDefinition,
  FunctionDefinition,
  SourceUnit,
  VariableDeclaration,
  YulAssignment,
} from 'solidity-ast/types';

export function* iterateContracts(
  sourceUnits: SourceUnit[],
  filter?: (sourceUnit: SourceUnit, contractNode: ContractDefinition) => boolean
): Generator<[SourceUnit, ContractDefinition]> {
  for (const sourceUnit of sourceUnits) {
    for (const contractNode of findAll(sourceUnit, 'ContractDefinition')) {
      if (!filter || filter(sourceUnit, contractNode)) {
        yield [sourceUnit, contractNode];
      }
    }
  }
}

export function* iterateVariables(
  contractNodes: [SourceUnit, ContractDefinition][],
  filter?: (node: VariableDeclaration) => boolean
): Generator<[SourceUnit, ContractDefinition, VariableDeclaration]> {
  for (const [sourceUnit, contractNode] of contractNodes) {
    for (const variableNode of findAll(contractNode, 'VariableDeclaration', filter)) {
      yield [sourceUnit, contractNode, variableNode];
    }
  }
}

export function* iterateFunctions(
  sourceUnits: SourceUnit[],
  filter?: (node: FunctionDefinition) => boolean
): Generator<[SourceUnit, ContractDefinition, FunctionDefinition]> {
  for (const [sourceUnit, contractNode] of iterateContracts(sourceUnits)) {
    for (const functionNode of findAll(contractNode, 'FunctionDefinition', filter)) {
      yield [sourceUnit, contractNode, functionNode];
    }
  }
}

export function* iterateSlotAssignments(
  sourceUnits: SourceUnit[]
): Generator<[SourceUnit, ContractDefinition, FunctionDefinition, YulAssignment]> {
  for (const [sourceUnit, contractNode, functionNode] of iterateFunctions(
    sourceUnits,
    _isPureInternal
  )) {
    // Do not include slot assignments from coverage
    if (functionNode.name.startsWith('c_')) continue;

    const yulAssignments = findAll(functionNode, 'YulAssignment', (node) => {
      return node.variableNames[0].name.endsWith('.slot');
    });

    if (!yulAssignments.length) continue;
    if (yulAssignments.length > 1) {
      throw new Error('Cannon have a function that assigns slots several times');
    }

    yield [sourceUnit, contractNode, functionNode, yulAssignments[0]];
  }
}

function _isPureInternal(node: FunctionDefinition) {
  return node.stateMutability === 'pure' && node.visibility === 'internal';
}
