const { equal } = require('assert/strict');
const { findContractDefinitions } = require('@synthetixio/core-js/utils/ast/finders');
const asts = require('@synthetixio/core-js/test/fixtures/initializable-ast.json');
const { clone } = require('@synthetixio/core-js/utils/misc/clone');
const ModuleInitializableASTValidator = require('../../../internal/initializable-ast-validator');

describe('internal/initializable-ast-validator.js', function () {
  const fqNames = Object.values(asts).flatMap((sourceNode) =>
    findContractDefinitions(sourceNode).map(
      (contractNode) => `${sourceNode.absolutePath}:${contractNode.name}`
    )
  );

  const initMixin = 'contracts/initializable/InitializableMixin.sol:InitializableMixin';

  describe('validations without errors (happy path)', () => {
    let sampleAsts, validator;
    let errorsFound = [];

    before('set asts and validator', () => {
      sampleAsts = clone(asts);
      validator = new ModuleInitializableASTValidator(
        fqNames,
        Object.values(sampleAsts),
        initMixin
      );
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

    before('set asts, modify it and validator', () => {
      sampleAsts = clone(asts);

      // Update asts (introduce error)
      sampleAsts['contracts/mocks/initializable/InitializableMock.sol'].nodes[3].nodes[5].name =
        'not_initializeInitializableMock';

      validator = new ModuleInitializableASTValidator(
        fqNames,
        Object.values(sampleAsts),
        initMixin
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = validator.findMissingInitializer();
    });

    it('should find a missing initializer function', () => {
      equal(errorsFound.length, 1);
    });
  });

  describe('missing isInitialized', () => {
    let sampleAsts, validator;
    let errorsFound = [];

    before('set asts, modify it and validator', () => {
      sampleAsts = clone(asts);

      // Update asts (introduce error)
      sampleAsts['contracts/mocks/initializable/InitializableMock.sol'].nodes[3].nodes[6].name =
        'not_isInitializableMockInitialized';

      validator = new ModuleInitializableASTValidator(
        fqNames,
        Object.values(sampleAsts),
        initMixin
      );
    });

    before('use the validator to find problems', async () => {
      errorsFound = validator.findMissingIsInitialized();
    });

    it('should find a missing isInitialized function', () => {
      equal(errorsFound.length, 1);
    });
  });
});
