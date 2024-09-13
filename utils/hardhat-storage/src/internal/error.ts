import { render } from './render';

import type { ASTNode, AssemblyItem, BaseASTNode } from '@solidity-parser/parser/src/ast-types';

export class ValidationError extends Error {}

/**
 * Create a ValidationError with a custom stack trace generated based on the
 * given AST nodes, and print the solidity path stack trace.
 */
export function createError({
  message,
  sourceName,
  nodes = [],
}: {
  message: string;
  sourceName: string;
  nodes: (ASTNode | AssemblyItem)[];
}) {
  const err = new ValidationError(message);
  const [title] = err.stack!.split('\n');
  const stack: string[] = [];

  try {
    for (const node of nodes) {
      const title = _renderTitle(node);
      if (!title) continue;
      stack.unshift(`    at ${title} (${sourceName}${_renderLoc(node)})`);
    }
  } catch (err) {
    console.warn('Could not render stack trace.', err);
  }

  stack.unshift(title);
  err.stack = stack.join('\n');
  return err;
}

function _renderTitle(node: ASTNode | AssemblyItem) {
  switch (node.type) {
    case 'ContractDefinition':
      return `${node.kind} ${node.name}`;
    case 'VariableDeclaration':
      return render(node);
    default:
      return typeof (node as { name: string }).name === 'string'
        ? (node as { name: string }).name
        : node.type;
  }
}

function _renderLoc(node: BaseASTNode) {
  if (!node.loc) return '';
  const loc = [`:${node.loc.start.line}`];
  if (node.loc.start.column) loc.push(`:${node.loc.start.column}`);
  return loc.join('');
}
