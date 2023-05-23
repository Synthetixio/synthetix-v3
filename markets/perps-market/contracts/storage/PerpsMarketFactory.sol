//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {IMarketCollateralModule} from "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {MathUtil} from "../utils/MathUtil.sol";

/**
 * @title Main factory library that registers perps markets.  Also houses global configuration for all perps markets.
 */
library PerpsMarketFactory {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    bytes32 private constant _SLOT_PERPS_MARKET_FACTORY =
        keccak256(abi.encode("io.synthetix.perps-market.PerpsMarketFactory"));

    error OnlyMarketOwner(address marketOwner, address sender);
    error InvalidMarket(uint128 marketId);

    error MaxCollateralExceeded(uint128 marketId);

    struct Data {
        /**
         * @dev oracle manager address used for price feeds
         */
        INodeModule oracle;
        ITokenModule usdToken;
        /**
         * @dev Synthetix core v3 proxy address
         */
        ISynthetixSystem synthetix;
        ISpotMarketSystem spotMarket;
        // max collateral amounts / market
        mapping(uint128 => uint) maxCollateralAmounts;
        /**
         * @dev when deducting from user's margin which is made up of many synths, this priority governs which synth to sell for deduction
         */
        uint128[] synthDeductionPriority;
        uint128[] perpsMarketIds;
        uint maxLeverage;
        SetUtil.UintSet liquidatableAccounts;
        // collateral amounts running total
        mapping(uint128 => uint) collateralAmounts;
        mapping(uint128 => address) marketOwners;
    }

    function load() internal pure returns (Data storage perpsMarketFactory) {
        bytes32 s = _SLOT_PERPS_MARKET_FACTORY;
        assembly {
            perpsMarketFactory.slot := s
        }
    }

    /*
        1. checks to ensure max cap isn't hit
        2. adjusts accounting for collateral amounts
    */
    function checkCollateralAmountAndAdjust(
        Data storage self,
        uint128 synthMarketId,
        int synthAmount
    ) internal {
        if (synthAmount > 0) {
            if (
                self.collateralAmounts[synthMarketId] + synthAmount.toUint() >
                self.maxCollateralAmounts[synthMarketId]
            ) {
                revert MaxCollateralExceeded(synthMarketId);
            } else {
                self.collateralAmounts[synthMarketId] += synthAmount.toUint();
            }
        } else {
            self.collateralAmounts[synthMarketId] -= MathUtil.abs(synthAmount);
        }
    }

    function depositToMarketManager(Data storage self, uint128 marketId, uint256 amount) internal {
        self.usdToken.approve(address(this), amount);
        self.synthetix.depositMarketUsd(marketId, address(this), amount);
    }

    function onlyMarketOwner(Data storage self, uint128 marketId) internal view {
        address marketOwner = self.marketOwners[marketId];

        if (marketOwner != msg.sender) {
            revert OnlyMarketOwner(marketOwner, msg.sender);
        }
    }
}
