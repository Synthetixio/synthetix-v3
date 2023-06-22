//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {IAccountModule} from "../interfaces/IAccountModule.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {Position} from "../storage/Position.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

contract PerpsAccountModule is IAccountModule {
    using PerpsAccount for PerpsAccount.Data;
    using Position for Position.Data;
    using AsyncOrder for AsyncOrder.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;

    function modifyCollateral(
        uint128 accountId,
        uint128 synthMarketId,
        int amountDelta
    ) external override {
        Account.exists(accountId);
        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        if (amountDelta == 0) revert InvalidAmountDelta(amountDelta);

        PerpsMarketFactory.Data storage perpsMarketFactory = PerpsMarketFactory.load();

        GlobalPerpsMarket.Data storage globalPerpsMarket = GlobalPerpsMarket.load();
        globalPerpsMarket.checkCollateralAmountAndAdjust(synthMarketId, amountDelta);
        globalPerpsMarket.checkLiquidation(accountId);

        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        if (account.id == 0) {
            account.id = accountId;
        }

        ITokenModule synth = synthMarketId == 0
            ? perpsMarketFactory.usdToken
            : ITokenModule(perpsMarketFactory.spotMarket.getSynth(synthMarketId));

        if (amountDelta > 0) {
            // adding collateral
            account.addCollateralAmount(synthMarketId, amountDelta.toUint());

            synth.transferFrom(msg.sender, address(this), amountDelta.toUint());
        } else {
            uint amountAbs = MathUtil.abs(amountDelta);
            // removing collateral
            account.checkAvailableWithdrawableValue(amountAbs);
            account.removeCollateralAmount(synthMarketId, amountAbs);

            synth.transfer(msg.sender, amountAbs);
        }

        emit CollateralModified(accountId, synthMarketId, amountDelta, msg.sender);
    }

    function totalCollateralValue(uint128 accountId) external view override returns (uint) {
        return PerpsAccount.load(accountId).getTotalCollateralValue();
    }

    function totalAccountOpenInterest(uint128 accountId) external view override returns (uint) {
        return PerpsAccount.load(accountId).getTotalNotionalOpenInterest();
    }

    function getOpenPosition(
        uint128 accountId,
        uint128 marketId
    ) external view override returns (int, int, int) {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.loadValid(marketId);

        Position.Data storage position = perpsMarket.positions[accountId];

        (, int pnl, int accruedFunding, , ) = position.getPositionData(
            PerpsPrice.getCurrentPrice(marketId)
        );
        return (pnl, accruedFunding, position.size);
    }

    function getAsyncOrderClaim(
        uint128 accountId,
        uint128 marketId
    ) external view override returns (AsyncOrder.Data memory) {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.loadValid(marketId);

        AsyncOrder.Data storage asyncOrder = perpsMarket.asyncOrders[accountId];

        return asyncOrder;
    }

    function getAvailableMargin(uint128 accountId) external view override returns (int) {
        return PerpsAccount.load(accountId).getAvailableMargin();
    }
}
