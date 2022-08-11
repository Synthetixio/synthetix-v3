const { equal, ok } = require('assert/strict');
const { findContractDefinitions } = require('@synthetixio/core-js/utils/ast/finders');
const ModuleStorageASTValidator = require('../../../internal/storage-ast-validator');
const { default: asts } = require('@synthetixio/core-js/test/fixtures/asts.json')
const { default: variableNode } = require('@synthetixio/core-js/test/fixtures/variableDefNodeAst.json')
const { clone } = require('@synthetixio/core-js/utils/misc/clone');

describe('internal/storage-ast-validator.js', function () {
  const fqNames = Object.values(asts).flatMap((sourceNode) =>
    findContractDefinitions(sourceNode).map(
      (contractNode) => `${sourceNode.absolutePath}:${contractNode.name}`
    )
  );

  describe('validations without errors (happy path)', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      previousAsts = clone(asts);
      validator = new ModuleStorageASTValidator(
        fqNames,
        Object.values(currentAsts),
        Object.values(previousAsts)
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound.push(...validator.findNamespaceCollisions());
      errorsFound.push(...validator.findNamespaceSlotChanges());
      errorsFound.push(...(await validator.findInvalidNamespaceMutations()));
      errorsFound.push(...validator.findRegularVariableDeclarations());
    });

    it('should not find errors in a normal deployment', () => {
      equal(errorsFound.length, 0);
    });
  });

  describe('change slot address', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      previousAsts = clone(asts);
      currentAsts[
        'ProxyNamespace'
      ].nodes[1].nodes[1].body.statements[0].AST.statements[0].value.value =
        '0x9dbde58b6f7305fccdc5abd7ea1096e84de3f9ee47d83d8c3efc3e5557ac9c00';
      validator = new ModuleStorageASTValidator(
        fqNames,
        Object.values(currentAsts),
        Object.values(previousAsts)
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = validator.findNamespaceSlotChanges();
    });

    it('should find a change in the slot', () => {
      equal(errorsFound.length, 1);
      ok(errorsFound[0].msg.includes('Storage namespace hash change'));
    });
  });

  describe('duplicate slot address', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      currentAsts[
        'ProxyNamespace'
      ].nodes[1].nodes[1].body.statements[0].AST.statements[0].value.value =
        '0x1f33674ed9c09f309c0798b8fcbe9c48911f48b2defee8aecb930c5ef6f80e37';
      previousAsts = clone(asts);
      validator = new ModuleStorageASTValidator(
        fqNames,
        Object.values(currentAsts),
        Object.values(previousAsts)
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = validator.findNamespaceCollisions();
    });

    it('should find a duplicate address', () => {
      equal(errorsFound.length, 1);
      ok(errorsFound[0].msg.includes('Duplicate namespaces slot found'));
    });
  });

  describe('change struct member name', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      currentAsts['ProxyNamespace'].nodes[1].nodes[0].members[0].name = 'modifiedName';
      previousAsts = clone(asts);
      validator = new ModuleStorageASTValidator(
        fqNames,
        Object.values(currentAsts),
        Object.values(previousAsts)
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = await validator.findInvalidNamespaceMutations();
    });

    it('should find a duplicate address', () => {
      equal(errorsFound.length, 1);
      ok(errorsFound[0].msg.includes('Invalid modification mutation found in namespace'));
    });
  });

  describe('change struct member type', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      currentAsts['ProxyNamespace'].nodes[1].nodes[0].members[0].typeDescriptions.typeString =
        'bytes32';
      previousAsts = clone(asts);
      validator = new ModuleStorageASTValidator(
        fqNames,
        Object.values(currentAsts),
        Object.values(previousAsts)
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = await validator.findInvalidNamespaceMutations();
    });

    it('should find a duplicate address', () => {
      equal(errorsFound.length, 1);
      ok(errorsFound[0].msg.includes('Invalid modification mutation found in namespace'));
    });
  });

  describe('change struct add member', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      const newMember = clone(currentAsts['ProxyNamespace'].nodes[1].nodes[0].members[1]);
      newMember.name = 'newMember;';
      currentAsts['ProxyNamespace'].nodes[1].nodes[0].members.splice(1, 0, newMember);
      previousAsts = clone(asts);
      validator = new ModuleStorageASTValidator(
        fqNames,
        Object.values(currentAsts),
        Object.values(previousAsts)
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = await validator.findInvalidNamespaceMutations();
    });

    it('should find a duplicate address', () => {
      equal(errorsFound.length, 1);
      ok(errorsFound[0].msg.includes('Invalid modification mutation found in namespace'));
    });
  });

  describe('change struct modify multiple members', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      currentAsts['ProxyNamespace'].nodes[1].nodes[0].members[0].typeDescriptions.typeString =
        'bytes32';
      currentAsts['ProxyNamespace'].nodes[1].nodes[0].members[1].name = 'modifiedName';

      previousAsts = clone(asts);

      validator = new ModuleStorageASTValidator(
        fqNames,
        Object.values(currentAsts),
        Object.values(previousAsts)
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = await validator.findInvalidNamespaceMutations();
    });

    it('should find a duplicate address', () => {
      equal(errorsFound.length, 1);
      ok(errorsFound[0].msg.includes('Invalid modification mutation found in namespace'));
    });
  });

  describe('change struct remove member', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      currentAsts['ProxyNamespace'].nodes[1].nodes[0].members.pop();
      previousAsts = clone(asts);
      validator = new ModuleStorageASTValidator(
        fqNames,
        Object.values(currentAsts),
        Object.values(previousAsts)
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = await validator.findInvalidNamespaceMutations();
    });

    it('should find a duplicate address', () => {
      equal(errorsFound.length, 1);
      ok(errorsFound[0].msg.includes('Invalid removal mutation found in namespac'));
    });
  });

  describe('change struct remove multiple members', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      currentAsts['ProxyNamespace'].nodes[1].nodes[0].members.pop();
      previousAsts = clone(asts);
      const newMember = clone(previousAsts['ProxyNamespace'].nodes[1].nodes[0].members[1]);
      newMember.name = 'newMember;';
      previousAsts['ProxyNamespace'].nodes[1].nodes[0].members.push(newMember);
      validator = new ModuleStorageASTValidator(
        fqNames,
        Object.values(currentAsts),
        Object.values(previousAsts)
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = await validator.findInvalidNamespaceMutations();
    });

    it('should find a duplicate address', () => {
      equal(errorsFound.length, 1);
      ok(errorsFound[0].msg.includes('Invalid removal mutation found in namespace'));
    });
  });

  describe('change struct add nested struct', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      const newMember = clone(currentAsts['ProxyNamespace'].nodes[1].nodes[0].members[1]);
      newMember.name = 'newMember';
      newMember.typeDescriptions.typeString = 'struct SetUtil.Bytes32Set';
      currentAsts['ProxyNamespace'].nodes[1].nodes[0].members.push(newMember);
      previousAsts = clone(asts);
      validator = new ModuleStorageASTValidator(
        fqNames,
        Object.values(currentAsts),
        Object.values(previousAsts)
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = await validator.findNestedStructDeclarations();
    });

    it('should find a nested storage', () => {
      equal(errorsFound.length, 1);
      ok(errorsFound[0].msg.includes('Nested structs at'));
    });
  });

  describe('contract variable declarations', () => {
    describe('valid constant declaration', () => {
      let currentAsts, previousAsts, validator;
      let errorsFound = [];

      before('set asts and validator', () => {
        currentAsts = clone(asts);
        previousAsts = clone(asts);

        currentAsts['AnotherModule'].nodes[3].nodes.splice(0, 0, clone(variableNode));

        validator = new ModuleStorageASTValidator(
          fqNames,
          Object.values(currentAsts),
          Object.values(previousAsts)
        );
      });

      before('use the validator to find problems', async () => {
        errorsFound = validator.findRegularVariableDeclarations();
      });

      it('should not find errors', () => {
        equal(errorsFound.length, 0);
      });
    });

    describe('valid immutable declaration', () => {
      let currentAsts, previousAsts, validator;
      let errorsFound = [];

      before('set asts and validator', () => {
        currentAsts = clone(asts);
        previousAsts = clone(asts);

        const varNode = clone(variableNode);
        varNode.mutability = 'immutable';

        currentAsts['AnotherModule'].nodes[3].nodes.splice(0, 0, varNode);

        validator = new ModuleStorageASTValidator(
          fqNames,
          Object.values(currentAsts),
          Object.values(previousAsts)
        );
      });

      before('use the validator to find problems', async () => {
        errorsFound = validator.findRegularVariableDeclarations();
      });

      it('should not find errors', () => {
        equal(errorsFound.length, 0);
      });
    });

    describe('invalid regular declaration', () => {
      let currentAsts, previousAsts, validator;
      let errorsFound = [];

      before('set asts and validator', () => {
        currentAsts = clone(asts);
        previousAsts = clone(asts);

        const varNode = clone(variableNode);
        varNode.mutability = 'mutable';

        currentAsts['AnotherModule'].nodes[3].nodes.splice(0, 0, varNode);

        validator = new ModuleStorageASTValidator(
          fqNames,
          Object.values(currentAsts),
          Object.values(previousAsts)
        );
      });

      before('use the validator to find problems', async () => {
        errorsFound = validator.findRegularVariableDeclarations();
      });

      it('should find an error', () => {
        ok(errorsFound[0].msg.includes('Unsafe state variable declaration in'));
        equal(errorsFound.length, 1);
      });
    });
  });
});
