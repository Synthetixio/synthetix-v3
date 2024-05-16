import {
  AssemblyAssignment,
  ContractDefinition,
  FunctionDefinition,
  SourceUnit,
} from '@solidity-parser/parser/src/ast-types';
import { findAll } from './finders';

export function* iterateContracts(
  sourceUnits: SourceUnit[]
): Generator<[SourceUnit, ContractDefinition]> {
  for (const sourceUnit of sourceUnits) {
    for (const contractNode of findAll(sourceUnit, 'ContractDefinition')) {
      yield [sourceUnit, contractNode];
    }
  }
}

export function* iterateSlotAssignments(
  sourceUnits: SourceUnit[]
): Generator<[SourceUnit, ContractDefinition, FunctionDefinition, AssemblyAssignment]> {
  for (const [sourceUnit, contractNode] of iterateContracts(sourceUnits)) {
    for (const functionNode of findAll(contractNode, 'FunctionDefinition', _isPureInternal)) {
      const assignments = findAll(functionNode, 'AssemblyAssignment', (node) => {
        return (
          node.names[0].type === 'AssemblyMemberAccess' && node.names[0].memberName.name === 'slot'
        );
      });

      if (!assignments.length) continue;
      if (assignments.length > 1) {
        throw new Error('Cannon have a function that assigns slots several times');
      }

      yield [sourceUnit, contractNode, functionNode, assignments[0]];
    }
  }
}

function _isPureInternal(node: FunctionDefinition) {
  return node.stateMutability === 'pure' && node.visibility === 'internal';
}
