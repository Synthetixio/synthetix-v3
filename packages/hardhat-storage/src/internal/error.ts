import { Node, YulNode } from 'solidity-ast/node';
import { SourceUnit } from 'solidity-ast/types';
import { render } from './render';

export class ValidationError extends Error {}

/**
 * Create a ValidationError with a custom stack trace generated based on the
 * given AST nodes, and print the solidity path stack trace.
 */
export function createError({
  message,
  sourceUnit,
  nodes = [],
}: {
  message: string;
  sourceUnit: SourceUnit;
  nodes: (Node | YulNode)[];
}) {
  const err = new ValidationError(message);
  const [title] = err.stack!.split('\n');
  const stack: string[] = [];

  try {
    const { absolutePath } = sourceUnit;
    for (const node of nodes) {
      const title = _getErrorTitle(node);
      if (!title) continue;
      stack.unshift(`    at ${title} (${absolutePath})`);
    }
  } catch (err) {
    console.warn('Could not render stack trace.');
  }

  stack.unshift(title);
  err.stack = stack.join('\n');
  return err;
}

function _getErrorTitle(node: Node | YulNode) {
  /* eslint-disable */
  switch (node.nodeType) {
    case 'ContractDefinition':
      return `${node.contractKind} ${node.name}`;
    case 'VariableDeclaration':
      return render(node);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default:
      return (node as any).name as string;
  }
}
