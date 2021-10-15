const { equal } = require('assert/strict');
const ModuleStorageASTValidator = require('../../../internal/storage-ast-validator');
const asts = require('@synthetixio/core-js/test/fixtures/asts.json');
const { clone } = require('@synthetixio/core-js/utils/clone');

describe('internal/storage-ast-validator.js', function () {
  describe('validations without errors (happy path)', async () => {
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

    it('shold not find errors in a normal deployment', () => {
      equal(errorsFound.length, 0);
    });
  });
});
