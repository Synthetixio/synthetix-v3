# Quanto Perpetual Futures Market

This document provides a brief set up of instructions for devs to run the quanto perps system on a local node.

## Developer Pre-requisites

You need the following tools installed:
- Yarn
- Foundry
- Cannon

### Foundry Installation

1. Install foundry see - https://github.com/foundry-rs/foundry, https://book.getfoundry.sh/getting-started/installation - or simply follow below instructions:
```bash
curl -L https://foundry.paradigm.xyz | bash
# restart terminal
foundryup
```
2. Test foundry is working by running `anvil`
```bash
anvil
```
This should boot up a local test ethereum node. If successful exit the process with `cntrl+c`.

### Cannon Installation

```bash
npm install -g @usecannon/cli
```

## Developer Get Started

1. Clone this repo:
```bash
git clone git@github.com:Kwenta/synthetix-v3.git
```
2. Checkout the `dev` branch
```bash
git checkout dev
```
3. Run `yarn` at the root directory: `/synthetix-v3`.
4. Run `yarn compile-contracts` at the root directory: `/synthetix-v3`.
5. Run `yarn generate-testable` at the root directory: `/synthetix-v3`.
6. Run `yarn build-testable` at the root directory: `/synthetix-v3`.
7. Jump into the `perps-market` directory: `cd markets/perps-market`
8. Run `yarn build-testable`
9. Launch a local node with the test build:
```bash
# The exact version may change from 3.3.15 - check your terminal output from yarn build-testable for the latest
cannon synthetix-perps-market:3.3.15-testable@main
```
10. Press `i` to interact with contracts via the command line.
11. Scroll down to `PerpsMarketProxy` and hit `enter`
12. View proxy address: `PerpsMarketProxy => 0xSomeAddress...ADF989`

You should now be able to plug into the perps market via this address, nice!

## Troubleshooting

If you experience any unexpected errors try running:

- `yarn clean`
