# Insurance Market

This system implements a market which insures against loss due to insolvency from another market.

It accomplishes this by opening insurance "agreements" with an address that purchases it. This
agreement incurs an upfront cost called the "premium" which is paid directly to stakers backing
the market. In return, the market will, in exchange for the position NFT/market issued token, repay the lost market position in the case that the
target market goes insolvent, up to a limit of time and amount.

Ideally, this market could be integrated into any trading UI to provide additional verifiable
protection to a position with a simple checkbox like "protect my position for $X" and included
as part of a multicall.

## Opening a policy



## Making a claim



## Computation of the insurance premium



## Development

`yarn start`
