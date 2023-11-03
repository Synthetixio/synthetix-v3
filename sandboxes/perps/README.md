# Synthetix Perps Sandbox

## Running custom code

Building custom code on sandbox requires `perps-sandbox` package to be published to Cannon registry: https://usecannon.com/packages/perps-sandbox/latest/13370-main

```sh
cannon build cannonfile.consumer.toml
```

This should result in a successful local build that runs a few transactions as a test user

```sh
TRANSACTIONS:
╔═══════════════════════════════════════════════════╤════════════════════════════════════════════════════════════════════╗
║ test_user_creates_account                         │ 0x6c177529a249768ea21826467f3350f6da5113886e1c1b81cdfd1c9b17247382 ║
╟───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ test_user_mints_10k_box                           │ 0xe6873010d0d9d416ca1003e165a1890f8ff5e03cc124b68d0c6ab89beb3e25c5 ║
╟───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ test_user_approves_10k_box_for_CoreProxy_to_spend │ 0x15996fc321a066a457fa5c295050d99059af3875f5e127da86350ed11a10eaee ║
╟───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ test_user_deposits_1k_box                         │ 0x85a875c0cf47c2819494c589cfc605aa55a53b890d678504620b98d22e5f52b4 ║
╟───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ test_user_delegates_900_box                       │ 0x848a72b8fd8a0682291357873c854f1effce7fa7ce695f6aeb063b2e6ae410a7 ║
╟───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ test_user_borrows_300_susd                        │ 0x7c2447896e675b44b6c24ec3ed5388786007c84d5e03dd2cbf4b259aa5fef120 ║
╟───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ test_user_withdraw_300_susd                       │ 0xd48abefbe8583887bdc7bcaf36f917aca4cec1d827899ecef70f89232e277cf3 ║
╚═══════════════════════════════════════════════════╧════════════════════════════════════════════════════════════════════╝


EXTRA DATA:
╔══════════════════════╤═══╗
║ test_user_account_id │ 1 ║
╚══════════════════════╧═══╝

Successfully built package perps-sandbox-consumer-example:1@main
 - Deploy Url: ipfs://QmbkTt6wcLihN5JpcYcYtKRhLVRyX1sdSDDMycdqC4ZCVK
```

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

```sh
TRANSACTIONS:
╔════════════════════════════════════════════════════╤════════════════════════════════════════════════════════════════════╗
║ configure_minimum_liquidity_ratio                  │ 0x023bff8388f04652a649e0323540a9d0a5aaef830656cd2d70d1dc8ba5982d66 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_withdraw_timeout                         │ 0x84f00a56463c189913d26840e5be7c78533e575762e27a0699ee3cf5a4ad6f43 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ create_synth_box                                   │ 0xf1372a266ff7aeba7efec887db1be0c19c2402debbac3170bb55feab9b38c36d ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ create_synth_eth                                   │ 0xf00646c38ab761809f2377031da112cfe9793622bf3dc7764b98112b8950b54e ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ permit_owner_to_create_pools                       │ 0x026b027659dec998ebf873662dc45d33dc874b7535f4acd0a357d6b590be7f4e ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ permit_owner_to_register_markets                   │ 0xbf3743b280e0d4d5a70f5d06a97229f95d473d0abc4b3dc7da6387dae1721d55 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ register_box_oracle_node_with_constant_price       │ 0x4bd1cda777e0e55555673fd539fc748fc09db0f4bfa80ea27f426bd9fa285c90 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ register_eth_oracle_node_with_constant_price       │ 0xb0c249406be9c3ebbcf849f1b5c79417c3c5109ad4d97a680ad9f81247792b11 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_async_fixed_fee_for_synth_eth            │ 0xcc16b1982e55296efde9aa6ddd4bda8cc765ea8afc3030204fec27c87dfdfd9a ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_atomic_fixed_fee_for_synth_eth           │ 0x238546d66f1b7c0864d9e135ba1a396cf7033692b9c9e1a057d18361f82fa485 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_box_token_as_collateral                  │ 0x14241df4dd67af6f42e87087aece9536f0c542511f3cde688aabdc1c8660a471 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_market_skew_scale_for_synth_eth          │ 0xfd0a237488858015cf4f8388857572cbdc8f150a643f3a2f3295385ab2a25a55 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_max_collateral_amount_for_perps_eth      │ 0x08156bdf01eca09dcf258de50991605cd0269505ea6e12ca50a508fdd1bf5c76 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_maximum_market_collateral_for_synth_eth  │ 0x076ef14dea2341fe1c3e5b78c6002f22bc8b42bfcffd86391784de1ce1d1f4e9 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_per_account_caps_perps                   │ 0x0a4ddf9948da42bd05120caeddfbc49f29521a1244bb621072b7a106e60d9152 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_perps_liquidation_reward_limits          │ 0xb08c850a33f9de45d6a2ab3351dee4072b103c87ab938a208d32d7ca57eef5f4 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_perps_max_collateral_for_susd            │ 0xc528f0159015729a7be6458ac1a9c74fd98d1597f20638fc9d323ebece870692 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_perps_synth_deduction_priority           │ 0x73feb2d884266d56e3815d0cbae70025ff2da198d3cafa139ef66e751eda9c27 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_price_data_for_synth_box                 │ 0x9e17b57ccc1eaf6bb12815b8d8d0c57645c312a04abc4aee0261aecddebbe822 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_price_data_for_synth_eth                 │ 0xcbc5f7361ac25d7eaa138d7d19dbcf2e7ea56bb57a8c1f3193b4cb01a5002424 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_settlement_strategy_for_synth_eth        │ 0x40227804fb45a35d025d1f437a804e13acf6c495659f0e4dea54bb5811c2adad ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_wrapper_fees_for_synth_eth               │ 0xb6c00a0adda8e6742a324945a2cc2782cc4e77e9f2c942274053fb009a23327a ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ create_eth_perps_market                            │ 0x42a5a0787803d9a4322c973d6925bdd7d7dd7a53d2946b71e5a952bfa39667d4 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ create_spartan_council_pool                        │ 0x0839dfaa0d2d139c954e61e942710667b2a29c74a1fae4e0f3ac3e18c7eb2ece ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ initialise_synth_weth_wrapper_with_unlimited_cap   │ 0xb570f6a4f8e97eab9509e67203b5cee2c334e5f93c883a02fd95df07e0620e34 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_funding_parameters_for_perps_eth         │ 0x45fd47491960f5d55bc6d2e739fafcda048113c84b6fddf176fac18e8bc9828c ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_liquidation_parameters_for_perps_eth     │ 0x3594f6a3454094843ae0b0702d2000494ca091808a3227a4019a692ec0a85c0e ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_locked_oi_ratio_for_perps_eth            │ 0x103c800b2d6153147bde7024a3f758934a404bc2b6b36e44810793550d1e7521 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_max_liquidation_parameters_for_perps_eth │ 0xc8513fd1bf2d7b3eff7903ca8cedf35394bfad542349ecf1ed6ff83b499b1332 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_max_market_size_for_perps_eth            │ 0x1cf6c6a2bfb468cabd3e21ed1112fe778a805a7aa90f3927780c7a79214e9c0b ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_order_fees_for_perps_eth                 │ 0x4147170d306adabcbcf9b3d92b6dfe343febb855a072b0a53952b6edc5ba1364 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_price_data_for_perps_eth                 │ 0xa72c08b418c700c3970213d46dcc4f9c9fe287ecc4dbc4bbcc9363cc6319ec12 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_settlement_strategy_for_perps_eth        │ 0xc9da9e8653d71bb6077f59fba47df1234260d076a74eb77c0bf8df1483907311 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_spartan_council_pool                     │ 0x235a3fc044bdf5e6c4bb56c6b3b068b091a3529c2a4e9f56fb3afa94bd3e08d1 ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ configure_spartan_council_pool_name                │ 0x1052843e730e03a93b3b1a7a061cad262167d2fdc329fcfc9cc3ca4fc52ee86a ║
╟────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ make_spartan_council_pool_a_preferred_pool         │ 0xc7aad051331285ee0d577693c10eaa9b9f13b18215896e65f712b16509cd5684 ║
╚════════════════════════════════════════════════════╧════════════════════════════════════════════════════════════════════╝


EXTRA DATA:
╔═════════════════════════╤════════════════════════════════════════════════════════════════════╗
║ synth_box_market_id     │ 2                                                                  ║
╟─────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ synth_box_token_address │ 0x4f7FD215bB2080a02146e9C2C09E2f94029e3115                         ║
╟─────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ synth_eth_market_id     │ 3                                                                  ║
╟─────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ synth_eth_token_address │ 0xe29BFf2B560c897B993Be1f9F3F92E2419256d7d                         ║
╟─────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ box_oracle_id           │ 0x9c81bfa1ae369ece55d1556bbd564992b6b83ccf607dd5c16e58359dd447d529 ║
╟─────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ eth_oracle_id           │ 0x7ade6324a9aeeb40703f1e9938d8f5d76a8467e2a54f89ceae87b2257d15725f ║
╟─────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ perps_eth_market_id     │ 100                                                                ║
╟─────────────────────────┼────────────────────────────────────────────────────────────────────╢
║ spartan_council_pool_id │ 1                                                                  ║
╚═════════════════════════╧════════════════════════════════════════════════════════════════════╝

Successfully built package perps-sandbox:1@main
 - Deploy Url: ipfs://Qmb1S1qU7H1grnVw5fyJEvBBdr6FWXs8iMSaJzTST5ZDH2
```

Then it needs to be published

```sh
DEBUG=cannon:* cannon publish perps-sandbox:1 --private-key $MAINNET_DEPLOYER_PRIVATE_KEY --tags latest
```
