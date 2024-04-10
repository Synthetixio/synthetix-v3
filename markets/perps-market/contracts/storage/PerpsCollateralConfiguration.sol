//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsPrice} from "./PerpsPrice.sol";
import {Price} from "@synthetixio/spot-market/contracts/storage/Price.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {LiquidationAssetManager} from "./LiquidationAssetManager.sol";
import {SNX_USD_MARKET_ID} from "./PerpsAccount.sol";

/**
 * @title Configuration of all multi collateral assets used for trader margin
 */
library PerpsCollateralConfiguration {
    using DecimalMath for uint256;

    /**
     * @notice Thrown when attempting to access a not registered id
     */
    error InvalidId(uint128 id);

    struct Data {
        /**
         * @dev Collateral Id (same as synth id)
         */
        uint128 id;
        /**
         * @dev Max amount of collateral that can be used for margin
         */
        uint256 maxAmount;
        /**
         * @dev Collateral value is discounted and capped at this value.  In % units.
         */
        uint256 upperLimitDiscount;
        /**
         * @dev Collateral value is discounted and at minimum, this value.  In % units.
         */
        uint256 lowerLimitDiscount;
        /**
         * @dev This value is used to scale the impactOnSkew of the collateral.
         */
        uint256 discountScalar;
        /**
         * @dev Liquidation Asset Manager data. (see LiquidationAssetManager.Data struct).
         */
        LiquidationAssetManager.Data lam;
    }

    /**
     * @dev Load the collateral configuration data using collateral/synth id
     */
    function load(uint128 collateralId) internal pure returns (Data storage collateralConfig) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.CollateralConfiguration", collateralId)
        );
        assembly {
            collateralConfig.slot := s
        }
    }

    /**
     * @dev Load a valid collateral configuration data using collateral/synth id
     */
    function loadValid(uint128 collateralId) internal view returns (Data storage collateralConfig) {
        collateralConfig = load(collateralId);
        if (collateralConfig.id == 0) {
            revert InvalidId(collateralId);
        }
    }

    /**
     * @dev Load a valid  collateral LiquidationAssetManager configuration data using collateral/synth id
     */
    function loadValidLam(
        uint128 collateralId
    ) internal view returns (LiquidationAssetManager.Data storage collateralLAMConfig) {
        collateralLAMConfig = load(collateralId).lam;
        if (collateralLAMConfig.id == 0) {
            revert InvalidId(collateralId);
        }
    }

    function validDistributorExists(uint128 collateralId) internal view returns (bool) {
        return
            (collateralId == SNX_USD_MARKET_ID) ||
            (loadValidLam(collateralId).distributor != address(0));
    }

    function setMax(Data storage self, uint128 collateralId, uint256 maxAmount) internal {
        if (self.id == 0) self.id = collateralId;
        self.maxAmount = maxAmount;
    }

    function setDiscounts(
        Data storage self,
        uint256 upperLimitDiscount,
        uint256 lowerLimitDiscount,
        uint256 discountScalar
    ) internal {
        self.upperLimitDiscount = upperLimitDiscount;
        self.lowerLimitDiscount = lowerLimitDiscount;
        self.discountScalar = discountScalar;
    }

    function getConfig(
        Data storage self
    )
        internal
        view
        returns (
            uint256 maxAmount,
            uint256 upperLimitDiscount,
            uint256 lowerLimitDiscount,
            uint256 discountScalar
        )
    {
        maxAmount = self.maxAmount;
        upperLimitDiscount = self.upperLimitDiscount;
        lowerLimitDiscount = self.lowerLimitDiscount;
        discountScalar = self.discountScalar;
    }

    function isSupported(Data storage self) internal view returns (bool) {
        return self.maxAmount != 0;
    }

    function valueInUsd(
        Data storage self,
        uint256 amount,
        ISpotMarketSystem spotMarket,
        PerpsPrice.Tolerance stalenessTolerance,
        bool useDiscount
    ) internal view returns (uint256 collateralValueInUsd, uint256 discount) {
        uint256 skewScale = spotMarket.getMarketSkewScale(self.id);
        // only discount collateral if skew scale is set on spot market and useDiscount is set to true
        if (useDiscount && skewScale != 0) {
            uint256 impactOnSkew = amount.divDecimal(skewScale).mulDecimal(self.discountScalar);
            discount = (
                MathUtil.max(
                    MathUtil.min(impactOnSkew, self.lowerLimitDiscount),
                    self.upperLimitDiscount
                )
            );
        }
        // first get value of collateral in usd
        (uint256 valueWithoutDiscount, ) = spotMarket.quoteSellExactIn(
            self.id,
            amount,
            Price.Tolerance(uint256(stalenessTolerance)) // solhint-disable-line numcast/safe-cast
        );

        // if discount is 0, this just gets multiplied by 1
        collateralValueInUsd = valueWithoutDiscount.mulDecimal(DecimalMath.UNIT - discount);
    }
}
