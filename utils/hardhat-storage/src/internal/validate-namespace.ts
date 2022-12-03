import { findOne } from '@synthetixio/core-utils/utils/ast/finders';
import { Node, YulNode } from 'solidity-ast/node';
import { FunctionDefinition } from 'solidity-ast/types';
import { createError } from './error';
import { iterateSlotAssignments } from './iterators';
import { isPresent } from './misc';
import { render } from './render';
import { ValidateParams } from './validate';

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
      if (val.nodeType === 'YulFunctionCall') {
        return _error(
          'Store assignments can only be literal assignments, not FunctionCall',
          yulAssignment
        );
      }

      let slot: string;
      if (val.nodeType === 'YulLiteral') {
        slot = render(val);
      } else {
        // Find when the value is declared
        const varStatement = _findVariableDeclarationStatementOf(functionNode, val.name);

        if (!varStatement) {
          return _error(`Could not find variable declaration value for "${val.name}"`, val);
        }

        const varDeclaration = findOne(varStatement, 'VariableDeclaration');

        if (!varDeclaration) return _error('Missing var declaration statement', varStatement);

        const varType = varDeclaration.typeDescriptions.typeString;

        if (varType !== 'bytes32') {
          return _error(
            `Was expecting a slot type value of "bytes32", but "${varType}" was given`,
            varDeclaration
          );
        }

        if (!varStatement.initialValue) return _error('Slot value not initialized', varStatement);

        slot = render(varStatement.initialValue);
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
