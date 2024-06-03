import { Address, BigInt } from '@graphprotocol/graph-ts';

// Initialize a Token Definition with the attributes
export class TokenDefinition {
  address: Address;
  symbol: string;
  name: string;
  decimals: BigInt;

  // Get all tokens with a static defintion
  static getStaticDefinitions(): Array<TokenDefinition> {
    const staticDefinitions: Array<TokenDefinition> = [
      {
        address: Address.fromString('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'),
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: BigInt.fromI32(18),
      },
      {
        address: Address.fromString('0x912ce59144191c1204e64559fe8253a0e49e6548'),
        symbol: 'ARB',
        name: 'Arbitrum',
        decimals: BigInt.fromI32(18),
      },
    ];
    return staticDefinitions;
  }

  // Helper for hardcoded tokens
  static fromAddress(tokenAddress: Address): TokenDefinition | null {
    const staticDefinitions = this.getStaticDefinitions();
    const tokenAddressHex = tokenAddress.toHexString();

    // Search the definition using the address
    for (let i = 0; i < staticDefinitions.length; i++) {
      const staticDefinition = staticDefinitions[i];
      if (staticDefinition.address.toHexString() == tokenAddressHex) {
        return staticDefinition;
      }
    }

    // If not found, return null
    return null;
  }
}
