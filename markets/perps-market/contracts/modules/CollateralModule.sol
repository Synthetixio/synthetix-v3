//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
// TODO: use decay token module?
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ICollateralModule} from "../interfaces/ICollateralModule.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";

contract CollateralModule is ICollateralModule {
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using PerpsAccount for PerpsAccount.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    bytes32 private constant _MODIFY_COLLATERAL_FEATURE_FLAG = "modifyCollateral";

    function setMaxCollateralAmount(uint128 synthId, uint maxCollateralAmount) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketFactory.Data storage perpsMarketFactory = PerpsMarketFactory.load();
        perpsMarketFactory.maxCollateralAmounts[synthId] = maxCollateralAmount;

        // TODO: emit event
    }

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
}
