const { equal } = require('assert/strict');
const ModuleInitializableASTValidator = require('../../../internal/initializable-ast-validator');
const asts = require('@synthetixio/core-js/test/fixtures/asts.json');
const { clone } = require('@synthetixio/core-js/utils/misc/clone');

describe('internal/initializable-ast-validator.js', function () {
  describe('validations without errors (happy path)', () => {
    let sampleAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      sampleAsts = clone(asts);
      validator = new ModuleInitializableASTValidator(sampleAsts);
    });

    before('use the validator to find problems', async () => {
      errorsFound.push(...validator.findMissingInitializer());
      errorsFound.push(...validator.findMissingIsInitialized());
    });

    it('should not find errors in a normal deployment', () => {
      equal(errorsFound.length, 0);
    });
  });

  describe('missing initializer', () => {
    let sampleAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      sampleAsts = clone(asts);

      // Update asts (introduce error) 
      sampleAsts[
        'ProxyNamespace'
      ].nodes[1].nodes[1].body.statements[0].AST.statements[0].value.value =
        '0x9dbde58b6f7305fccdc5abd7ea1096e84de3f9ee47d83d8c3efc3e5557ac9c00';

      validator = new ModuleInitializableASTValidator(sampleAsts);
    });

    before('use the validator to find problems', async () => {
      errorsFound = validator.findMissingInitializer();
    });

    it('should find a change in the slot', () => {
      equal(errorsFound.length, 1);
    });
  });

  describe('missing isInitialized', () => {
    let sampleAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      sampleAsts = clone(asts);

      // Update asts (introduce error) 
      sampleAsts[
        'ProxyNamespace'
      ].nodes[1].nodes[1].body.statements[0].AST.statements[0].value.value =
        '0x9dbde58b6f7305fccdc5abd7ea1096e84de3f9ee47d83d8c3efc3e5557ac9c00';

      validator = new ModuleInitializableASTValidator(sampleAsts);
    });

    before('use the validator to find problems', async () => {
      errorsFound = validator.findMissingIsInitialized();
    });

    it('should find a duplicate address', () => {
      equal(errorsFound.length, 1);
    });
  });
});
