//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {IAccountModule} from "../interfaces/IAccountModule.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {Position} from "../storage/Position.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

contract PerpsAccountModule is IAccountModule {
    using PerpsAccount for PerpsAccount.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;

    function modifyCollateral(
        uint128 accountId,
        uint128 synthMarketId,
        int amountDelta
    ) external override {
        // TODO: check amountDelta is non-zero
        // TODO: RBAC check for permission of msg.sender for account id

        // FeatureFlag.ensureAccessToFeature(_MODIFY_COLLATERAL_FEATURE_FLAG);
        Account.exists(accountId);
        PerpsMarketFactory.Data storage perpsMarketFactory = PerpsMarketFactory.load();
        perpsMarketFactory.checkCollateralAmountAndAdjust(synthMarketId, amountDelta);

        PerpsAccount.Data storage accountData = PerpsAccount.load(accountId);
        accountData.checkLiquidationFlag();

        ITokenModule synth = synthMarketId == 0
            ? perpsMarketFactory.usdToken
            : ITokenModule(perpsMarketFactory.spotMarket.getSynth(synthMarketId));

        if (amountDelta > 0) {
            // adding collateral
            accountData.addCollateralAmount(synthMarketId, amountDelta.toUint());

            synth.transferFrom(msg.sender, address(this), amountDelta.toUint());
        } else {
            uint amountAbs = MathUtil.abs(amountDelta);
            // removing collateral
            accountData.checkAvailableCollateralAmount(synthMarketId, amountAbs);
            accountData.checkAvailableWithdrawableValue(accountId, amountDelta);

            accountData.removeCollateralAmount(synthMarketId, amountAbs);

            synth.transfer(msg.sender, amountAbs);
        }

        // TODO: emit event
    }

    function totalCollateralValue(uint128 accountId) external view override returns (uint) {
        return PerpsAccount.load(accountId).getTotalCollateralValue();
    }

    function totalAccountOpenInterest(uint128 accountId) external view override returns (int) {
        return PerpsAccount.load(accountId).getTotalNotionalOpenInterest(accountId);
    }

    function openPosition(
        uint128 accountId,
        uint128 marketId
    ) external view override returns (int, int, int) {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        Position.Data storage position = perpsMarket.positions[accountId];

        (, int pnl, int accruedFunding, , ) = position.getPositionData(
            PerpsPrice.getCurrentPrice(marketId)
        );
        return (pnl, accruedFunding, position.size);
    }
}
