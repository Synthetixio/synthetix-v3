# bfp-market

**Welcome to bfp-market!**

bfp (big ~~fucking~~ freaking perps) market is a simplified SNX perps v2 market, built on top of SNX v3. This is still in development and massively subject to change, use with caution.

## Development

```bash
# Download and install repository
git clone git@github.com:davidvuong/bfp-market.git

# Install dependencies
#
# Note: It's --legacy-peer-deps due to nested conflicting dependencies on cannon.
npm i --legacy-peer-deps

# Install ipfs
#
# @see: https://docs.ipfs.tech/install/ipfs-desktop/

# Install anvil
#
# @see: https://github.com/foundry-rs/foundry/tree/master/anvil

# Configure cannon locally (use default prompts)
#
# @see: https://usecannon.com/docs
npx cannon setup

# Build using cannon + hardhat
npm run build

# Run tests
npm run test
```

## Testing

The test environment is a composition of `bootstrap` function calls, tighly coupled with Synthetix. As such, much of the design choices follow that of Synthetix V3 for consistency. A base `bootstrap()` function is provided which does the following:

- Invokes `coreBootstrap` from Synthetix to setup base Synthetix contracts
- Creates a single staking pool with liquidity to back test markets
- Generates TypeScript interfaces and aliases for test development
- Registers and configures perp markets with the core system

All of these operates happen asynchronously in loosely chained `before` blocks.

## TODO

- [ ] Debt calculations
- [ ] New liquidations (progressive liquidation over a period of time)
- [ ] New Margin Maintenance Margin Ratio Calculation
- [ ] Add position specific views (position summary like accrued funding, PnL etc.)
- [ ] Events throughout contracts
- [ ] `postTradeDetails` missing on check on `liquidationPremium`
- [ ] Market pause features (Perhaps pause types: CLOSE_ONLY, PAUSED, AVAILABLE)
