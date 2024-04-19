//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/IAddressResolver.sol";
import "./external/IV3CoreProxy.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

/**
 * @title A token that can be "unwrapped" into another token by the "owner" of a 
 * redemption turning in shares of this token. This contract is used by the LegacyMarket
 * to enable V3 staking while keeping the proportional distribution of debt the same.
 */
interface IRedeemableToken is IERC20 {
    event Redeemed(
        address indexed redeemer,
        uint256 sharesRedeemed,
        uint256 tokensRedeemed
    );

    /**
     * @notice Called by the owner of the redeemable token to mint new redeemable tokens
		 * and set up a redemption plan
     */
    function addRedemption(
        address redeemer,
				uint256 shareAmount,
				uint256 tokenAmount
			) external;

    /**
		 * @notice Called by a redemption holder to grain access to their redeemed tokens
     */
    function redeem(uint256 sharesAmount) external;
}
