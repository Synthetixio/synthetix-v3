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
        address: Address.fromString('0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f'),
        symbol: 'SNX',
        name: 'Synthetix Network Token',
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
