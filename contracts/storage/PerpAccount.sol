//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @dev A transferrable abstraction to encapsulate positions, orders, and collateral associated to an owner.
 */
library PerpAccount {
    struct Data {
        // A unique perp account id for account reference.
        uint128 id;
        // {collateralAddress: amountDeposited}.
        mapping(address => uint256) depositedCollateral;
    }

    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.Account", id));

        assembly {
            account.slot := s
        }
    }
}
