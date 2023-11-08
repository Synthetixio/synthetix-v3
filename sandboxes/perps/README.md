# Synthetix Perps Sandbox

## Running custom code

Building custom code on sandbox requires `perps-sandbox` package to be published to Cannon registry: https://usecannon.com/packages/perps-sandbox/latest/13370-main

```sh
cannon build cannonfile.consumer.toml
```

This should result in a successful local build that runs a few transactions as a test user

To verify that transactions took place, we can manually check test user wallet balance of sUSD

Firstly, run cannon in interactive mode

```sh
cannon run perps-sandbox-consumer-example:1@main --impersonate 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
# then press 'i'
```

Then interact with `USDProxy.balanceOf(address)`

```sh
✔ Pick a CONTRACT: › synthetix.USDProxy
synthetix.USDProxy => 0x629673e90e428069AeB328DE4EF2040a7C22f723
  * Signer: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

✔ Pick a FUNCTION: › balanceOf(address)
✔ owner (address) … 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  > calldata: 0x70a0823100000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8
  > estimated gas required: 32443
  ↪ (uint256): 300000000000000000000 (300.00000)
```

## Building sandbox

In case there is a need to update and publish a new version of sandbox itself, we need to build it and publish to the cannon registry

```sh
cannon build cannonfile.toml
```

This results in the list of steps executed, configuring synthetix v3 core, spartan council pool, mintable tokens, synths, and perps market

Then it needs to be published

```sh
DEBUG=cannon:* cannon publish perps-sandbox:1 --private-key $MAINNET_DEPLOYER_PRIVATE_KEY --tags latest
```
