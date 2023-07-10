# bfp-market

**Welcome to bfp-market!**

bfp (big fucking perps) market is a simplified SNX perps v2 market, built on top of SNX v3. This is still in development and massively subject to change, use with caution.

## Development

```bash
# Download and install repository
git clone git@github.com:davidvuong/bfp-market.git

# Install dependencies
npm i

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
```

## TODO

- [ ] Debt calculations
- [ ] New liquidations (progressive liquidation over a period of time)
- [ ] New Margin Maintenance Margin Ratio Calculation
- [ ] Move market configuration into separate storage
- [ ] Add position specific views (position summary like accrued funding, PnL etc.)
- [ ] Events throughout contracts
- [ ] `postTradeDetails` missing on check on `liquidationPremium`
- [ ] `onlyOwner` specific configuration functions
