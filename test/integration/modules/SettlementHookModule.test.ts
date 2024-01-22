describe('SettlementHookModule', () => {
  describe('setSettlementHookConfiguration', () => {
    it('should configure settlement hooks');

    it('should override existing config');

    it('should remove previously whitelistd hook');

    it('should add new hook and not change previously configured hooks');

    it('should revert when settlment hook does not support interface');

    it('should revert with non-owner');
  });

  describe('getSettlementHookConfiguration', () => {
    it('should retrieve configured settlment hooks');
  });
});
