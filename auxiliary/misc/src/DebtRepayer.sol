// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ISynthetixCore} from "./ISynthetixCore.sol";
import {ISpotMarket} from "./ISpotMarket.sol";
import {IUSDToken} from "./IUSDToken.sol";
import {ERC2771Context} from "./ERC2771Context.sol";

/**
 * Tiny contract which deposits the needed amount of collateral into synthetix v3 account for debt repayment
 */
contract DebtRepayer {
    function depositDebtToRepay(
        ISynthetixCore synthetixCore,
        ISpotMarket spotMarket,
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint128 spotMarketId
    ) public {
        address msgSender = ERC2771Context._msgSender();
        int256 debt = synthetixCore.getPositionDebt(accountId, poolId, collateralType);
        if (debt > 0) {
            (uint256 neededSynth,) = spotMarket.quoteSellExactOut(spotMarketId, uint256(debt), 0);
            (address toWrapToken,) = spotMarket.getWrapper(spotMarketId);
            uint256 toWrapTokenDecimals = IUSDToken(toWrapToken).decimals();
            uint256 toWrapTokenAmount = neededSynth * (10 ** toWrapTokenDecimals) / (10 ** 18) + 1;
            IUSDToken(toWrapToken).transferFrom(msgSender, address(this), uint256(toWrapTokenAmount));
            IUSDToken(toWrapToken).approve(address(spotMarket), toWrapTokenAmount);
            spotMarket.wrap(spotMarketId, toWrapTokenAmount, neededSynth);
            spotMarket.sellExactOut(spotMarketId, uint256(debt), neededSynth, address(0));
            IUSDToken(synthetixCore.getUsdToken()).approve(address(synthetixCore), uint256(debt));
            synthetixCore.deposit(accountId, synthetixCore.getUsdToken(), uint256(debt));
        }
    }
}
