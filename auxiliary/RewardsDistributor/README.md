Official Rewards Distributor for intreacting with [Synthetix V3](https://docs.synthetix.io/v/v3/for-liquidity-pool-managers/rewards-distributors)

## Running tests

```sh
forge test -vvvvv --watch src test
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
