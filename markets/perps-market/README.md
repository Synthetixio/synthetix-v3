# Perpetual Futures Market

This system generates markets that allow traders to open positions (ERC-721 tokens) that are long or short with leverage after depositing collateral as margin.

## Developer Get Started

1. Ensure you have [IPFS Desktop](https://docs.ipfs.tech/install/ipfs-desktop/) running
2. Run `yarn` at the root directory: `/synthetix-v3`.
3. Run `yarn cannon setup` to configure cannon

- Run `cat ~/.local/share/cannon/settings.json` and ensure your `ipfsUrl` is configured to `http://localhost:5001`. If it's still unable to find your IPFS local node, try using `http://0.0.0.0:5001`.

4. Run `yarn build` at the root directory: `/synthetix-v3`.
5. Run `yarn test` in the synthetix protocol directory: `/protocol/synthetix`.

- This will create `synthetix-testable` version and throw it into your local IPFS cluster.

6. Run `yarn test` in the spot market directory: `/markets/spot-market`.

- This will create a `spot-market-testable` version and throw it into your local IPFS cluster.

7. Run `yarn test` in the perps market directory: `/markets/perps-market`.

- The perps market is composed of both the synthetix core and spot market contracts and uses the testable versions to create a testable perps market environment.

If you have passing tests at this point, **congrats**, you are all set for development.

## Troubleshooting

If you experience any unexpected errors try running:

- `yarn clean`
