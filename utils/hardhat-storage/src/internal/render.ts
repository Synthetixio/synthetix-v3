import { Node, YulNode } from 'solidity-ast/node';
import {
  ArrayTypeName,
  Block,
  ContractDefinition,
  ElementaryTypeName,
  ElementaryTypeNameExpression,
  EnumDefinition,
  EnumValue,
  FunctionCall,
  FunctionDefinition,
  Identifier,
  InlineAssembly,
  Literal,
  Mapping,
  MemberAccess,
  ParameterList,
  PragmaDirective,
  StructDefinition,
  UnaryOperation,
  UserDefinedTypeName,
  VariableDeclaration,
  VariableDeclarationStatement,
  YulAssignment,
  YulBlock,
  YulIdentifier,
  YulLiteral,
} from 'solidity-ast/types';

const TAB = '  ';

/**
 * Minimal solidity renderer, only renders contracts with storage slot assignments
 * and struct declarations.
 */
export function render<T extends Node | YulNode>(node: T) {
  if (!_has(_render, node.nodeType)) {
    console.log(JSON.stringify(node, null, 2));
    throw new Error(`Rendering of node of type "${node?.nodeType}" not implemented`);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return _render[node.nodeType](node as any);
  } catch (err) {
    console.log(JSON.stringify(node, null, 2));
    throw err;
  }
}

function _renderSemicolons(parentType: keyof typeof _colons) {
  return function (node: Parameters<typeof render>[0]) {
    const semi = _colons[parentType].includes(node.nodeType) ? ';' : '';
    return render(node) + semi;
  };
}

const _colons = {
  ContractDefinition: [
    'ErrorDefinition',
    'EventDefinition',
    'ModifierDefinition',
    'UsingForDirective',
    'VariableDeclaration',
  ],
  StructDefinition: ['VariableDeclaration'],
  Block: [
    'EmitStatement',
    'ExpressionStatement',
    'Return',
    'RevertStatement',
    'VariableDeclarationStatement',
  ],
  YulBlock: [
    'YulAssignment',
    'YulBreak',
    'YulContinue',
    'YulExpressionStatement',
    'YulLeave',
    'YulVariableDeclaration',
  ],
};

const _render = {
  PragmaDirective(node: PragmaDirective) {
    const [solidity, ...version] = node.literals;
    return `pragma ${solidity} ${version.join('')};`;
  },

  VariableDeclaration(node: VariableDeclaration) {
    const val: string[] = [render(node.typeName!) as string];

    if (node.stateVariable) val.push(node.visibility);
    if (node.mutability !== 'mutable') val.push(node.mutability);
    if (node.storageLocation !== 'default') val.push(node.storageLocation);

    val.push(node.name);

    if (node.value) val.push('=', render(node.value));

    return `${val.join(' ')}`;
  },

  VariableDeclarationStatement(node: VariableDeclarationStatement): string {
    if (node.declarations.length !== 1 || !node.declarations[0]) {
      throw new Error('Rendering of node not implemented');
    }

    const declaration = render(node.declarations[0]);

    return node.initialValue ? `${declaration} = ${render(node.initialValue)}` : declaration;
  },

  ElementaryTypeName(node: ElementaryTypeName) {
    return node.name;
  },

  EnumDefinition(node: EnumDefinition) {
    if (!Array.isArray(node.members) || !node.members.length) return 'enum {}';
    const members: string[] = node.members.map(render).map(_indent());
    return [`enum ${node.name} {`, members.join(',\n'), '}'].join('\n');
  },

  EnumValue(node: EnumValue) {
    return node.name;
  },

  UserDefinedTypeName(node: UserDefinedTypeName) {
    if (node.typeDescriptions.typeString?.startsWith('contract ')) {
      return 'address';
    }

    return node.pathNode!.name;
  },

  Mapping(node: Mapping): string {
    return `mapping(${render(node.keyType)} => ${render(node.valueType)})`;
  },

  ArrayTypeName(node: ArrayTypeName): string {
    return `${render(node.baseType)}[]`;
  },

  Literal(node: Literal) {
    if (!node.isPure || !['number', 'string'].includes(node.kind)) {
      throw new Error('Rendering of node not implemented');
    }

    return node.kind === 'string' ? `"${node.value}"` : `${node.value}`;
  },

  YulLiteral(node: YulLiteral) {
    if (!['number', 'string'].includes(node.kind)) {
      throw new Error('Rendering of node not implemented');
    }

    return node.kind === 'string' ? `"${node.value}"` : `${node.value}`;
  },

  ContractDefinition(node: ContractDefinition) {
    const children: string = node.nodes
      .map(_renderSemicolons('ContractDefinition'))
      .map(_indent())
      .join('\n');
    return [`${node.contractKind} ${node.name} {`, children, '}'].join('\n');
  },

  StructDefinition(node: StructDefinition) {
    if (node.visibility !== 'public') throw new Error('Rendering of node not implemented');
    const vars: string = node.members
      .map(_renderSemicolons('StructDefinition'))
      .map(_indent())
      .join('\n');
    return [`struct ${node.name} {`, vars, '}'].join('\n');
  },

  FunctionDefinition(node: FunctionDefinition) {
    if (node.kind !== 'function') throw new Error('Rendering of node not implemented');
    if (node.modifiers.length) throw new Error('Rendering of node not implemented');
    if (node.overrides) throw new Error('Rendering of node not implemented');

    const params: string = render(node.parameters);
    const attrs: string[] = [node.visibility, node.stateMutability];

    if (node.virtual) attrs.push('virtual');
    if (node.returnParameters.parameters.length) {
      attrs.push(`returns (${render(node.returnParameters)})`);
    }

    const semi = node.body ? '' : ';';
    const block: string = node.body ? render(node.body) : '';

    return `function ${node.name}(${params}) ${attrs.join(' ')}${semi}${block}`;
  },

  ParameterList(node: ParameterList): string {
    return node.parameters.map(render).join(', ');
  },

  Block(node: Block) {
    if (!Array.isArray(node.statements) || !node.statements.length) return ' {}';
    const statements: string[] = node.statements.map(_renderSemicolons('Block')).map(_indent());
    return [' {', ...statements, '}'].join('\n');
  },

  YulBlock(node: YulBlock) {
    if (!Array.isArray(node.statements) || !node.statements.length) return ' {}';
    const statements: string[] = node.statements.map(render).map(_indent());
    return ['assembly {', ...statements, '}'].join('\n');
  },

  YulAssignment(node: YulAssignment): string {
    if (node.variableNames.length !== 1) throw new Error('Rendering of node not implemented');
    return `${render(node.variableNames[0])} := ${render(node.value)}`;
  },

  InlineAssembly(node: InlineAssembly): string {
    return render(node.AST);
  },

  FunctionCall(node: FunctionCall) {
    const name: string = render(node.expression);
    const params: string[] = node.arguments.map(render);
    return `${name}(${params.join(', ')})`;
  },

  Identifier(node: Identifier) {
    return node.name;
  },

  YulIdentifier(node: YulIdentifier) {
    return node.name;
  },

  ElementaryTypeNameExpression(node: ElementaryTypeNameExpression) {
    return node.typeName.name;
  },

  MemberAccess(node: MemberAccess): string {
    return `${render(node.expression)}.${node.memberName}`;
  },

  UnaryOperation(node: UnaryOperation): string {
    return `${node.operator}${render(node.subExpression)}`;
  },
};

function _has<T>(obj: T, key: string | number | symbol): key is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function _indent(amount = 2) {
  const indentation = TAB.repeat(amount);
  return (str: string) => str.replace(/^(.+)/gm, `${indentation}$1`);
}
