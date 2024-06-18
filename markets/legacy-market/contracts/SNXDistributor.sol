//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import "./interfaces/external/IAddressResolver.sol";
import "./interfaces/external/ISynthetix.sol";
import "./interfaces/external/IV3CoreProxy.sol";

import "./interfaces/ISNXDistributor.sol";

import "./interfaces/ILegacyMarket.sol";

// solhint-disable meta-transactions/no-msg-sender

contract SNXDistributor is IRewardDistributor, ISNXDistributor {
    ILegacyMarket public legacyMarket;

    error Unauthorized(address);

    constructor(ILegacyMarket lm) {
        legacyMarket = lm;
    }

    function payout(
        uint128,
        uint128,
        address,
        address sender,
        uint256 amount
    ) external override returns (bool) {
        if (msg.sender != address(legacyMarket.v3System())) {
            revert Unauthorized(msg.sender);
        }

        ISynthetix oldSynthetix = ISynthetix(
            legacyMarket.v2xResolver().getAddress("ProxySynthetix")
        );
        oldSynthetix.transfer(sender, amount);

        return true;
    }

    function onPositionUpdated(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 newShares
    ) external override {}

    function token() external view override returns (address) {
        return legacyMarket.v2xResolver().getAddress("ProxySynthetix");
    }

    function supportsInterface(bytes4 interfaceID) external pure override returns (bool) {
        return
            interfaceID == type(IRewardDistributor).interfaceId ||
            interfaceID == this.supportsInterface.selector;
    }

    function name() external pure override returns (string memory) {
        return "SNX Inflation";
    }

    function notifyRewardAmount(uint256 reward) external {
        IV3CoreProxy v3System = legacyMarket.v3System();
        IAddressResolver v2xResolver = legacyMarket.v2xResolver();

        if (
            msg.sender != address(legacyMarket) &&
            msg.sender != v2xResolver.getAddress("RewardsDistributor")
        ) {
            revert Unauthorized(msg.sender);
        }

        v3System.distributeRewards(
            v3System.getPreferredPool(),
            v2xResolver.getAddress("ProxySynthetix"),
            reward,
            0,
            0
        );
    }
}
