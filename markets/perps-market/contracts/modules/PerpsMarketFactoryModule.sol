//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {Flags} from "../utils/Flags.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {InterestRate} from "../storage/InterestRate.sol";
import {IPerpsMarketFactoryModule} from "../interfaces/IPerpsMarketFactoryModule.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title Module for registering perpetual futures markets. The factory tracks all markets in the system and consolidates implementation.
 * @dev See IPerpsMarketFactoryModule.
 */
contract PerpsMarketFactoryModule is IPerpsMarketFactoryModule {
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using DecimalMath for uint256;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using SetUtil for SetUtil.UintSet;
    using PerpsMarket for PerpsMarket.Data;

    bytes32 private constant _ACCOUNT_TOKEN_SYSTEM = "accountNft";

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function initializeFactory(
        ISynthetixSystem synthetix,
        ISpotMarketSystem spotMarket
    ) external override returns (uint128) {
        OwnableStorage.onlyOwner();

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        uint128 perpsMarketId;
        if (factory.perpsMarketId == 0) {
            perpsMarketId = factory.initialize(synthetix, spotMarket);
        } else {
            perpsMarketId = factory.perpsMarketId;
        }

        emit FactoryInitialized(perpsMarketId);

        return perpsMarketId;
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function setPerpsMarketName(string memory marketName) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketFactory.load().name = marketName;
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function createMarket(
        uint128 requestedMarketId,
        string memory marketName,
        string memory marketSymbol
    ) external override returns (uint128) {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);
        FeatureFlag.ensureAccessToFeature(Flags.CREATE_MARKET);

        OwnableStorage.onlyOwner();
        PerpsMarketFactory.load().onlyIfInitialized();

        if (requestedMarketId == 0) {
            revert ParameterError.InvalidParameter("requestedMarketId", "cannot be 0");
        }

        PerpsMarket.createValid(requestedMarketId, marketName, marketSymbol);
        GlobalPerpsMarket.load().addMarket(requestedMarketId);

        emit MarketCreated(requestedMarketId, marketName, marketSymbol);

        return requestedMarketId;
    }

    /**
     * @inheritdoc IMarket
     */
    // solc-ignore-next-line func-mutability
    function name(uint128 perpsMarketId) external view override returns (string memory) {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        if (factory.perpsMarketId == perpsMarketId) {
            return string.concat(factory.name, " Perps Market");
        }

        return "";
    }

    /**
     * @inheritdoc IMarket
     */
    function reportedDebt(uint128 perpsMarketId) external view override returns (uint256) {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        if (factory.perpsMarketId == perpsMarketId) {
            // debt is the total debt of all markets
            // can be computed as total collateral value - sum_each_market( debt )
            GlobalPerpsMarket.Data storage globalMarket = GlobalPerpsMarket.load();
            uint256 collateralValue = globalMarket.totalCollateralValue();
            int256 totalMarketDebt;

            SetUtil.UintSet storage activeMarkets = globalMarket.activeMarkets;
            uint256 activeMarketsLength = activeMarkets.length();
            for (uint256 i = 1; i <= activeMarketsLength; i++) {
                uint128 marketId = activeMarkets.valueAt(i).to128();
                totalMarketDebt += PerpsMarket.load(marketId).marketDebt(
                    PerpsPrice.getCurrentPrice(marketId, PerpsPrice.Tolerance.DEFAULT)
                );
            }

            int256 totalDebt = collateralValue.toInt() + totalMarketDebt;
            return MathUtil.max(0, totalDebt).toUint();
        }

        return 0;
    }

    /**
     * @inheritdoc IMarket
     */
    function minimumCredit(uint128 perpsMarketId) external view override returns (uint256) {
        if (PerpsMarketFactory.load().perpsMarketId == perpsMarketId) {
            return GlobalPerpsMarket.load().minimumCredit(PerpsPrice.Tolerance.DEFAULT);
        }

        return 0;
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function interestRate() external view override returns (uint128) {
        return InterestRate.load().interestRate;
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function utilizationRate()
        external
        view
        override
        returns (uint256 rate, uint256 delegatedCollateral, uint256 lockedCredit)
    {
        return GlobalPerpsMarket.load().utilizationRate(PerpsPrice.Tolerance.ONE_MONTH);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IMarket).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
