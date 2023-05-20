# Perpetual Futures Market

This system generates markets that allow traders to open positions (ERC-721 tokens) that are long or short with leverage after depositing collateral as margin.

## Developer Get Started

1. Make sure you have latest cannon cli installed by running: `npm install -g @usecannon/cli`.
2. Ensure you have IPFS Desktop running and your local cannon settings configured.

- Run `cat ~/.local/share/cannon/settings.json` and ensure your `ipfsUrl` is configured to `http://localhost:5001`.

2. Run `yarn clean` to remove any old artifacts and cached files.
3. Run `yarn` at the root directory: `/synthetix-v3`.
4. Run `yarn build` at the root directory: `/synthetix-v3`.
5. Run `yarn test` in the synthetix protocol directory: `/protocol/synthetix`.

- This will create `synthetix-testable` version and throw it into your local IPFS cluster.

6. Run `yarn test` in the spot market directory: `/markets/spot-market`.

- This will create a `spot-market-testable` version and throw it into your local IPFS cluster.

7. Run `yarn test` in the perps market directory: `/markets/perps-market`.

- The perps market is composed of both the synthetix core and spot market contracts and uses the testable versions to create a testable perps market environment.

If you have passing tests at this point, **Congrats**, you are all set for development.
