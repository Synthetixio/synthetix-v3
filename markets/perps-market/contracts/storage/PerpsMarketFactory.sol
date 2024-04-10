//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsCollateralConfiguration} from "../storage/PerpsCollateralConfiguration.sol";
import {LiquidationAssetManager} from "../storage/LiquidationAssetManager.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {Price} from "@synthetixio/spot-market/contracts/storage/Price.sol";

/**
 * @title Main factory library that registers perps markets.  Also houses global configuration for all perps markets.
 */
library PerpsMarketFactory {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SetUtil for SetUtil.UintSet;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using PerpsMarket for PerpsMarket.Data;
    using LiquidationAssetManager for LiquidationAssetManager.Data;

    bytes32 private constant _SLOT_PERPS_MARKET_FACTORY =
        keccak256(abi.encode("io.synthetix.perps-market.PerpsMarketFactory"));

    error PerpsMarketNotInitialized();
    error PerpsMarketAlreadyInitialized();

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
        uint128 perpsMarketId;
        string name;
        /**
         * @dev all liquidated account's assets are sent to this address
         */
        address liquidationAssetManager;
    }

    function onlyIfInitialized(Data storage self) internal view {
        if (self.perpsMarketId == 0) {
            revert PerpsMarketNotInitialized();
        }
    }

    function onlyIfNotInitialized(Data storage self) internal view {
        if (self.perpsMarketId != 0) {
            revert PerpsMarketAlreadyInitialized();
        }
    }

    function load() internal pure returns (Data storage perpsMarketFactory) {
        bytes32 s = _SLOT_PERPS_MARKET_FACTORY;
        assembly {
            perpsMarketFactory.slot := s
        }
    }

    function initialize(
        Data storage self,
        ISynthetixSystem synthetix,
        ISpotMarketSystem spotMarket
    ) internal returns (uint128 perpsMarketId) {
        onlyIfNotInitialized(self); // redundant check, but kept here in case this internal is called somewhere else

        (address usdTokenAddress, ) = synthetix.getAssociatedSystem("USDToken");
        perpsMarketId = synthetix.registerMarket(address(this));

        self.spotMarket = spotMarket;
        self.synthetix = synthetix;
        self.usdToken = ITokenModule(usdTokenAddress);
        self.oracle = synthetix.getOracleManager();
        self.perpsMarketId = perpsMarketId;
    }

    function totalWithdrawableUsd() internal view returns (uint256) {
        Data storage self = load();
        return self.synthetix.getWithdrawableMarketUsd(self.perpsMarketId);
    }

    function depositMarketCollateral(
        Data storage self,
        ITokenModule collateral,
        uint256 amount
    ) internal {
        collateral.approve(address(self.synthetix), amount);
        self.synthetix.depositMarketCollateral(self.perpsMarketId, address(collateral), amount);
    }

    function depositMarketUsd(Data storage self, uint256 amount) internal {
        self.usdToken.approve(address(this), amount);
        self.synthetix.depositMarketUsd(self.perpsMarketId, address(this), amount);
    }

    function withdrawMarketUsd(Data storage self, address to, uint256 amount) internal {
        self.synthetix.withdrawMarketUsd(self.perpsMarketId, to, amount);
    }

    function transferLiquidatedSynth(
        Data storage self,
        uint128 collateralId,
        uint256 amount
    ) internal returns (uint256 synthValue) {
        address synth = self.spotMarket.getSynth(collateralId);
        self.synthetix.withdrawMarketCollateral(self.perpsMarketId, synth, amount);

        (synthValue, ) = self.spotMarket.quoteSellExactIn(
            collateralId,
            amount,
            Price.Tolerance.DEFAULT
        );

        PerpsCollateralConfiguration.loadValidLam(collateralId).distributeCollateral(synth, amount);
    }
}
