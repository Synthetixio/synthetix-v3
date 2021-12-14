const { equal } = require('assert/strict');
const ModuleStorageASTValidator = require('../../../internal/storage-ast-validator');
const asts = require('@synthetixio/core-js/test/fixtures/asts.json');
const { clone } = require('@synthetixio/core-js/utils/misc/clone');

describe('internal/storage-ast-validator.js', function () {
  describe('validations without errors (happy path)', () => {
    let currentAsts, previousAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      currentAsts = clone(asts);
      previousAsts = clone(asts);
      validator = new ModuleStorageASTValidator(currentAsts, previousAsts);
    });

    before('use the validator to find problems', async () => {
      errorsFound.push(...validator.findNamespaceCollisions());
      errorsFound.push(...validator.findNamespaceSlotChanges());
      errorsFound.push(...(await validator.findInvalidNamespaceMutations()));
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
      validator = new ModuleStorageASTValidator(currentAsts, previousAsts);
    });

    before('use the validator to find problems', async () => {
      errorsFound = validator.findNamespaceSlotChanges();
    });

    it('should find a change in the slot', () => {
      equal(errorsFound.length, 1);
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
      validator = new ModuleStorageASTValidator(currentAsts, previousAsts);
    });

    before('use the validator to find problems', async () => {
      errorsFound = validator.findNamespaceCollisions();
    });

    it('should find a duplicate address', () => {
      equal(errorsFound.length, 1);
    });
  });
});
