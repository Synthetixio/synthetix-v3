

describe('LegacyMarket', () => {
    before('deploy', async () => {

    });

    describe('convertUSD()', async () => {
        let beforeBalance: number;

        it('fails when convertUSD is 0', async () => {

        });

        it('fails when insufficient source balance', async () => {

        });

        it('fails when insufficient migrated collateral', async () => {

        });

        describe('when invoked', async () => {
            before('when invoked', async () => {

            });
    
            it('burns v2 USD', async () => {
    
            });
    
            it('mints v3 USD', async () => {
    
            });
    
            it('reduced market balance', async () => {
    
            });

            it('emitted an event', async () => {

            });
        });
    });

    async function testMigrate(doMigrateCall: () => Promise<string>) {
        it('fails when no debt to migrate', async () => {

        });

        describe('with a fake account with escrow entries and liquidation rewards', async () => {

            before('create escrow entries', async () => {

            });

            before('create liquidation reward', async () => {

            });

            // sanity
            it('should have expected total collateral', async () => {

            });

            describe('when invoked', () => {
                before('invoke', async () => {

                });

                it('cleared liquidation rewards balance', async () => {

                });

                it('removed all snx balance', async () => {

                });

                it('revoked escrow entries', async () => {

                });

                it('moved all collateral to v3 account', async () => {

                });

                it('assigned whatever debt they had pre migration', async () => {

                });

                it('undertook debt shares from user account', async () => {

                });

                it('sent v3 account to user', async () => {

                });

                it('emitted an event', async () => {

                });
            });
        });
    }

    describe('migrate()', () => {
        testMigrate(async () => {
            return '';
        });

        describe('when all accounts migrate to v3', () => {
            before('get list of all staking accounts', async () => {
    
            });

            before('call migrate for all accounts', async () => {

            });
    
            it('assigned all snx debt to legacy market', async () => {

            });

            it('can withdraw v2 USD for v3 USD', async () => {

            });
        });
    });

    describe('migrateOnBehalf()', () => {
        it('only works for owner', async () => {

        });

        testMigrate(async () => {
            return '';
        });
    });

    describe('setPauseStablecoinConversion', async () => {
        it('only works for owner', async () => {

        });

        it('sets the value', async () => {

        });
    });

    describe('setPauseMigration', async () => {
        it('only works for owner', async () => {

        });

        it('sets the value', async () => {

        });
    });
});