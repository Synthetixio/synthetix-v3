import type {
  ASTNode,
  AssemblyItem,
  PragmaDirective,
  SourceUnit,
  ContractDefinition,
  BaseASTNode,
  StructDefinition,
  VariableDeclaration,
  ElementaryTypeName,
  ArrayTypeName,
  UserDefinedTypeName,
  ImportDirective,
  Mapping,
  EnumDefinition,
  EnumValue,
} from '@solidity-parser/parser/src/ast-types';

const TAB = '  ';

/**
 * Minimal solidity renderer, only renders contracts with storage slot assignments
 * and struct declarations.
 */
export function render<T extends BaseASTNode | ASTNode | AssemblyItem>(node: T) {
  if (!_has(_render, node.type)) {
    console.log(JSON.stringify(node, null, 2));
    throw new Error(`Rendering of node of type "${node?.type}" not implemented`);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return _render[node.type](node as any);
  } catch (err) {
    console.log(JSON.stringify(node, null, 2));
    throw err;
  }
}

function _renderSemicolons(parentType: keyof typeof _colons) {
  return function (node: Parameters<typeof render>[0]) {
    const semi = _colons[parentType].includes(node.type) ? ';' : '';
    return render(node) + semi;
  };
}

const _colons = {
  ContractDefinition: [
    'CustomErrorDefinition',
    'EventDefinition',
    'ModifierDefinition',
    'UsingForDeclaration',
    'VariableDeclaration',
  ],
  StructDefinition: ['VariableDeclaration'],
  Block: [
    'EmitStatement',
    'ExpressionStatement',
    'ReturnStatement',
    'RevertStatement',
    'VariableDeclarationStatement',
  ],
};

const _normalize = {
  int: 'int256',
  uint: 'uint256',
  byte: 'bytes1',
  ufixed: 'ufixed128x18',
  fixed: 'fixed128x18',
};

const _render = {
  SourceUnit(node: SourceUnit) {
    const children: string[] = node.children.map(render);
    return children.join('\n\n');
  },

  PragmaDirective(node: PragmaDirective) {
    return `pragma ${node.name} ${node.value};`;
  },

  ImportDirective(node: ImportDirective) {
    if (node.unitAlias) {
      throw new Error('Rendering ImportDirective with aliases not implemented');
    }

    return `import "${node.pathLiteral.value}";`;
  },

  ContractDefinition(node: ContractDefinition) {
    const children: string = node.subNodes
      .map(_renderSemicolons('ContractDefinition'))
      .map(_indent())
      .join('\n');

    return [`${node.kind} ${node.name} {`, children, '}'].join('\n');
  },

  StructDefinition(node: StructDefinition) {
    const vars: string = node.members
      .map(_renderSemicolons('StructDefinition'))
      .map(_indent())
      .join('\n');

    return [`struct ${node.name} {`, vars, '}'].join('\n');
  },

  VariableDeclaration(node: VariableDeclaration) {
    const val: string[] = [render(node.typeName!) as string];

    if (node.visibility && !['internal', 'default'].includes(node.visibility)) {
      val.push(node.visibility);
    }

    if (node.isDeclaredConst) val.push('constant');
    if (node.storageLocation) val.push(node.storageLocation);

    if (typeof node.name !== 'string' || !node.name) {
      throw new Error('Missing variable name');
    }

    val.push(node.name);

    return `${val.join(' ')}`;
  },

  ElementaryTypeName(node: ElementaryTypeName) {
    const key = node.name as keyof typeof _normalize;
    return _normalize[key] || key;
  },

  ArrayTypeName(node: ArrayTypeName): string {
    if (node.length) {
      throw new Error('Rendering of ArrayTypeName with length not implemented');
    }

    return `${render(node.baseTypeName)}[]`;
  },

  Mapping(node: Mapping): string {
    if (node.keyName || node.valueName) {
      throw new Error('Rendering of Mapping with keyName or valueName not implemented');
    }

    return `mapping(${render(node.keyType)} => ${render(node.valueType)})`;
  },

  UserDefinedTypeName(node: UserDefinedTypeName) {
    return node.namePath;
  },

  EnumDefinition(node: EnumDefinition) {
    if (!Array.isArray(node.members) || !node.members.length) return 'enum {}';
    const members: string[] = node.members.map(render).map(_indent());
    return [`enum ${node.name} {`, members.join(',\n'), '}'].join('\n');
  },

  EnumValue(node: EnumValue) {
    return node.name;
  },
};

function _has<T>(obj: T, key: string | number | symbol): key is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function _indent(amount = 2) {
  const indentation = TAB.repeat(amount);
  return (str: string) => str.replace(/^(.+)/gm, `${indentation}$1`);
}
