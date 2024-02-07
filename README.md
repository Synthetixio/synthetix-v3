Official Rewards Distributor for intreacting with [Synthetix V3](https://docs.synthetix.io/v/v3/for-liquidity-pool-managers/rewards-distributors)

## Running tests for SnapshotRewardsDistributor

```sh
FOUNDRY_PROFILE=lite npx @usecannon/cli build cannonfile.snapshot.toml
FOUNDRY_PROFILE=lite CANNON_REGISTRY_PRIORITY=local npx @usecannon/cli build cannonfile.snapshot.test.toml
FOUNDRY_PROFILE=lite CANNON_REGISTRY_PRIORITY=local npx @usecannon/cli test cannonfile.snapshot.test.toml
```

## Running tests for RewardsDistributor

```sh
forge test -vvvvv \
  --watch src/RewardsDistributor.sol test/RewardsDistributorTest.sol \
  --match-path test/RewardsDistributorTest.sol
```

Coverage report

```sh
forge coverage --report lcov
genhtml ./lcov.info --output-directory coverage
```

To install `genhtml`:

```sh
brew install lcov
```
