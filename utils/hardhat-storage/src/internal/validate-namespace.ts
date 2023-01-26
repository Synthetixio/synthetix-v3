import { findOne } from '@synthetixio/core-utils/utils/ast/finders';
import { Node, YulNode } from 'solidity-ast/node';
import { FunctionDefinition, VariableDeclaration } from 'solidity-ast/types';
import { createError } from './error';
import { iterateSlotAssignments } from './iterators';
import { isPresent } from './misc';
import { render } from './render';
import { ValidateParams } from './validate';

const SLOT_FORMAT = /^keccak256\(abi\.encode\("[0-9a-zA-Z-_.]+"\)\)$/;

export function validateSlotNamespaceCollisions({ sourceUnits }: ValidateParams) {
  const slots: string[] = [];

  return [...iterateSlotAssignments(sourceUnits)]
    .map(([sourceUnit, contractNode, functionNode, yulAssignment]) => {
      const _error = (message: string, ...nodes: (Node | YulNode)[]) => ({
        message,
        sourceUnit,
        nodes: [contractNode, functionNode, ...nodes],
      });

      const val = yulAssignment.value;

      // The assignment of the .slot value should be an existing variable
      if (val.nodeType !== 'YulIdentifier') {
        return _error(
          'Store assignments can only be assignments to a constant value in the contract',
          yulAssignment
        );
      }

      // Find when the value is declared inside the current function
      const varStatement = _findVariableDeclarationStatementOf(functionNode, val.name);

      if (!varStatement) {
        return _error(`Could not find variable declaration value for "${val.name}"`, val);
      }

      if (!varStatement.initialValue) {
        return _error('Slot value not initialized', varStatement);
      }

      if (varStatement.initialValue.nodeType !== 'Identifier') {
        return _error('Slot value should be a contract constant', varStatement);
      }

      const slotName = varStatement.initialValue.name;

      const constantDeclaration = contractNode.nodes.find(
        (node) => node.nodeType === 'VariableDeclaration' && node.constant && node.name === slotName
      ) as VariableDeclaration | undefined;

      if (!constantDeclaration?.value) {
        return _error(
          'Slot value should be a contract constant with a value initialized',
          varStatement
        );
      }

      const varType = constantDeclaration.typeDescriptions.typeString;
      if (varType !== 'bytes32') {
        return _error(
          `Was expecting a slot type value of "bytes32", but "${varType}" was given`,
          constantDeclaration
        );
      }

      const slot = render(constantDeclaration.value);

      if (!SLOT_FORMAT.test(slot)) {
        return _error(
          `Store slot definition should have the format "keccak256(abi.encode("your-slot-name"))" but "${slot}" given.`,
          val
        );
      }

      if (slots.includes(slot)) {
        return _error(`Store slot definition repeated: ${slot}`, val);
      }

      slots.push(slot);
    })
    .filter(isPresent)
    .map((err) => createError(err));
}

function _findVariableDeclarationStatementOf(functionNode: FunctionDefinition, varName: string) {
  return findOne(functionNode, 'VariableDeclarationStatement', (declarationStatement) => {
    return !!findOne(declarationStatement, 'VariableDeclaration', ({ name }) => name === varName);
  });
}
