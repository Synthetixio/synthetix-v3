//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "@synthetixio/core-contracts/contracts/utils/HeapUtil.sol";

import "./Distribution.sol";
import "./CollateralConfiguration.sol";

import "../interfaces/external/IMarket.sol";

/**
 * @title TODO
 */
library Market {
    using Distribution for Distribution.Data;
    using HeapUtil for HeapUtil.Data;
    using MathUtil for uint256;

    error MarketNotFound(uint128 marketId);

    struct Data {
        /**
         * @dev Numeric identifier for the market.
         *
         * Must be unique.
         */
        uint128 id;
        /**
         * @dev Contract address of the market that implements the `IMarket` interface.
         *
         * Note: This object is how the system tracks the market. The actual market is external to the system, and its own contract.
         */
        address marketAddress;
        /**
         * @dev TODO The net difference between the USD burnt, and USD minted by the market.
         *
         * TODO: Elaborate on what it means for a market to mint and burn.
         */
        int128 issuance;
        /**
         * @dev TODO The total amount of USD that the market could withdraw, if it were to immediately unwrap all positions.
         *
         * TODO: Consider renaming to creditCapacity.
         */
        uint128 capacity;
        /**
         * @dev TODO The amount of debt that the market had, after the last time that its debt was distributed.
         *
         * TODO: In the description above, elaborate on "distributed". What does it mean? Distributed to whom?
         */
        int128 lastDistributedMarketBalance;
        /**
         * @dev TODO Array of pools for which the market has not yet hit maximum credit capacity.
         *
         * Note: Used to disconnect from pools when the market goes above maximum credit capacity.
         *
         * TODO: Comment on why a heap data structure is used here.
         */
        HeapUtil.Data inRangePools;
        /**
         * @dev TODO Array of pools for which the market has hit maximum credit capacity.
         *
         * Note: Used to reconnect to pools when the market falls below maximum credit capacity.
         *
         * TODO: Comment on why a heap data structure is used here.
         */
        HeapUtil.Data outRangePools;
        /**
         * @dev TODO A market's debt distribution connects markets to the debt distribution chain, i.e. pools. Pools are actors in the market's debt distribution, where the amount of shares they possess depends on the amount of collateral each pool provides to a market.
         *
         * The debt distribution chain will move debt from the market into its connected pools.
         *
         * Actors: Pools.
         * Shares: TODO USD value proportional to the amount of credit that the pool provides to the market.
         * Value per share: TODO Debt per dollar of credit.
         */
        Distribution.Data debtDist;
        /**
         * @dev TODO
         */
        mapping(uint128 => int) poolPendingDebt;
        /**
         * @dev TODO Array of entries of market provided collateral.
         *
         * Markets may obtain additional liquidity, beyond that coming from stakers, by providing their own collateral.
         *
         * TODO: Rename to depositedCollateralEntries?
         */
        // @notice the amount of collateral deposited by this market
        DepositedCollateral[] depositedCollateral;
        /**
         * @dev TODO
         */
        // @notice the maximum amount of a collateral type that this market can deposit
        mapping(address => uint) maximumDepositable;
    }

    /**
     * @dev TODO
     */
    struct DepositedCollateral {
        address collateralType;
        uint amount;
    }

    /**
     * @dev Returns the market stored at the specified pool id.
     *
     * TODO: Consider using a constant instead of a hardcoded string here, and likewise to all similar uses of storage access in the code.
     */
    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Market", id));
        assembly {
            data.slot := s
        }
    }

    /**
     * @dev Returns an array of ids representing the markets linked to the system at a particular contract address.
     *
     * Note: A contract implementing the `IMarket` interface may represent more than one market, and thus several market ids could be associated to a single address.
     */
    function loadIdsByAddress(address addr) internal pure returns (uint[] storage data) {
        bytes32 s = keccak256(abi.encode("Market_idsByAddress", addr));
        assembly {
            data.slot := s
        }
    }

    /**
     * @dev Retrieves the id of the last market created.
     *
     * TODO: Use constants for storage slots.
     */
    function loadLastId() internal view returns (uint128 data) {
        bytes32 s = keccak256(abi.encode("Market_lastId"));
        assembly {
            data := sload(s)
        }
    }

    /**
     * @dev Caches the id of the last market created.
     *
     * Used to automatically generate a new id when a market is created.
     *
     * TODO: Use constants for storage slots.
     */
    function storeLastId(uint128 newValue) internal {
        bytes32 s = keccak256(abi.encode("Market_lastId"));
        assembly {
            sstore(s, newValue)
        }
    }

    /**
     * @dev Given an external contract address representing an `IMarket`, creates a new id for the market and tracks it internally in the system.
     *
     * The id used to track the market will be automatically assigned by the system according to the last used id.
     *
     * Note: If an external `IMarket` contract tracks several market ids, this function should be called for each id.
     */
    function create(address market) internal returns (Market.Data storage self) {
        uint128 id = loadLastId();

        id++;

        self = load(id);

        self.id = id;
        self.marketAddress = market;

        // set indexes
        storeLastId(id);
        loadIdsByAddress(market).push(id);
    }

    /**
     * @dev TODO Queries the market contract for the amount of debt is has issued.
     *
     * The reported debt of a market represents the amount of USD that the market would ask the system to mint, if all its positions were to be immediately withdrawn.
     *
     * The reported debt of a market is collateralized by the assets in the pools which back it.
     *
     * See the `IMarket` interface.
     */
    function getReportedDebt(Data storage self) internal view returns (uint) {
        return IMarket(self.marketAddress).reportedDebt(self.id);
    }

    /**
     * @dev TODO
     */
    function getLockedLiquidity(Data storage self) internal view returns (uint) {
        return IMarket(self.marketAddress).locked(self.id);
    }

    /**
     * @dev TODO Returns the total balance of the market.
     *
     * A market's total balance represents TODO
     */
    function totalBalance(Data storage self) internal view returns (int) {
        return int(getReportedDebt(self)) + self.issuance - int(getDepositedCollateralValue(self));
    }

    /**
     * @dev TODO Returns the USD value for the total amount of collateral provided by the market itself.
     *
     * Note: This is not liquidity provided by stakers thorough pools.
     */
    function getDepositedCollateralValue(Data storage self) internal view returns (uint) {
        uint totalDepositedCollateralValue = 0;

        // Sweep all DepositedCollateral entries and aggregate their USD value.
        for (uint i = 0; i < self.depositedCollateral.length; i++) {
            DepositedCollateral memory entry = self.depositedCollateral[i];
            CollateralConfiguration.Data storage config = CollateralConfiguration.load(entry.collateralType);

            uint price = CollateralConfiguration.getCollateralPrice(config);

            totalDepositedCollateralValue += price.mulDecimal(entry.amount);
        }

        return totalDepositedCollateralValue;
    }

    /**
     * @dev TODO Returns the amount of shares that the given actor pool has in the market's debt distribution.
     *
     * These shares represent TODO
     */
    function getPoolLiquidity(Data storage self, uint128 poolId) internal view returns (uint) {
        return self.debtDist.getActorShares(bytes32(uint(poolId)));
    }

    /**
     * @dev TODO Returns potential contribution that this market...
     */
    function getCapacityContribution(
        Data storage self,
        uint liquidityShares,
        int maxDebtShareValue
    ) internal view returns (uint contribution) {
        // Value per share is high precision (1e27), so downscale to 1e18.
        int128 lowPrecisionValuePerShare = self.debtDist.valuePerShare / 1e9;

        // Determine how much the current value per share deviates from the maximum.
        // TODO: What if maxDebtShareValue < lowPrecisionValuePerShare? This would cause an integer overflow.
        uint deltaValuePerShare = uint(maxDebtShareValue - lowPrecisionValuePerShare);

        return uint(deltaValuePerShare).mulDecimal(liquidityShares);
    }

    /**
     * @dev TODO Returns true if the market's capacity, i.e. the amount of USD that it could immediately withdraw, is locked.
     */
    function isCapacityLocked(Data storage self) internal view returns (bool) {
        return self.capacity < getLockedLiquidity(self);
    }

    /**
     * @dev TODO
     *
     * TODO: Understand distributeDebt() first.
     */
    function rebalance(
        uint128 marketId,
        uint128 poolId,
        int maxDebtShareValue, // (in USD)
        uint amount // in collateralValue (USD)
    ) internal returns (int debtChange) {
        Data storage self = load(marketId);

        // this function is called by the pool at rebalance markets

        if (self.marketAddress == address(0)) {
            revert MarketNotFound(marketId);
        }

        distributeDebt(self, 9999999999);

        return adjustVaultShares(self, poolId, amount, maxDebtShareValue);
    }

    /**
     * @dev TODO
     *
     * TODO: Understand distributeDebt() first.
     */
    function adjustVaultShares(
        Data storage self,
        uint128 poolId,
        uint newLiquidity,
        int newPoolMaxShareValue
    ) internal returns (int debtChange) {
        uint oldLiquidity = getPoolLiquidity(self, poolId);
        int oldPoolMaxShareValue = -self.inRangePools.getById(uint128(poolId)).priority;

        //require(oldPoolMaxShareValue == 0, "value is not 0");
        //require(newPoolMaxShareValue == 0, "new pool max share value is in fact set");

        if (newPoolMaxShareValue <= self.debtDist.valuePerShare / 1e9) {
            // this will ensure calculations below can correctly gauge shares changes
            newLiquidity = 0;
            self.inRangePools.extractById(uint128(poolId));
        } else {
            self.inRangePools.insert(uint128(poolId), -int128(int(newPoolMaxShareValue)));
        }

        debtChange = self.poolPendingDebt[poolId] + self.debtDist.updateActorShares(bytes32(uint(poolId)), newLiquidity);
        self.poolPendingDebt[poolId] = 0;

        // recalculate market capacity
        if (newPoolMaxShareValue > self.debtDist.valuePerShare / 1e9) {
            self.capacity += uint128(getCapacityContribution(self, newLiquidity, newPoolMaxShareValue));
        }

        if (oldPoolMaxShareValue > self.debtDist.valuePerShare / 1e9) {
            self.capacity -= uint128(getCapacityContribution(self, oldLiquidity, oldPoolMaxShareValue));
        }
    }

    /**
     * @dev TODO
     */
    // the second parameter exists to act as an escape hatch/discourage against griefing
    /**
     * Rotates recorded allocation of debt to any connected pools.
     * NOTE: this function should be called before any pool alters its liquidity allocation (see `rebalance` above)
     */
    function distributeDebt(Data storage self, uint maxIter) internal {
        if (self.debtDist.totalShares == 0) {
            return; // Cannot distribute (or accumulate) debt when there are no shares.
        }

        // Get current and last known market balance.
        // Last known balance is cached each time this function is executed.
        // TODO: Rename to targetMarketBalance (in function below too)
        int256 targetBalance = totalBalance(self);
        int256 distributedMarketBalance = self.lastDistributedMarketBalance;
        int256 outstandingMarketBalance = targetBalance - distributedMarketBalance;

        // TODO: Explain what this is...
        // TODO: Use new function Distribution.getLowPrecisionValuePerShare().
        // Value per share is high precision (1e27), so downscale to 1e18.
        int128 lowPrecisionValuePerShare = self.debtDist.valuePerShare / 1e9;
        // TODO: Why this scaling? And rename.
        int256 xxxPrecisionOutstandingMarketBalance = outstandingMarketBalance * MathUtil.INT_UNIT;
        // TODO: What is this? And rename.
        int256 xxxRatio = xxxPrecisionOutstandingMarketBalance / int128(self.debtDist.totalShares);
        // TODO: Rename to targetDebtPerShare (in fn below too)
        int256 targetDebtPerDebtShare = lowPrecisionValuePerShare + xxxRatio;

        // TODO: Explain what this is, overall goal of the loop...
        // this loop should rarely execute the body. When it does, it only executes once for each pool that passes the limit.
        // since `_distributeMarket` is not run for most pools, market users are not hit with any overhead as a result of this,
        // additionally,
        for (
            uint i = 0;
            self.inRangePools.size() > 0 && -self.inRangePools.getMax().priority < targetDebtPerDebtShare && i < maxIter;
            i++
        ) {
            // Get the in-range-pool with the highest maximum debt share value.
            // TODO: Understand why we're getting this max.
            HeapUtil.Node memory heapNode = self.inRangePools.extractMax();
            // TODO: Use these below - can't atm because of stack too deep errors.
            // uint poolId = heapNode.id;
            int128 poolMaxShareValue = -heapNode.priority;

            // TODO: See below. Failed attempt to extract this code into a fn call.
            // TODO: Can call this with named parameters to avoid comments?
            // (int256 newDistributedMarketBalance, int256 newOutstandingMarketBalance) = _processInRangePool(
            //     heapNode.id, // poolId
            //     -heapNode.priority, // poolMaxDebtShare
            //     targetBalance,
            //     distributedMarketBalance
            // );
            // distributedMarketBalance = newDistributedMarketBalance;
            // outstandingMarketBalance = newOutstandingMarketBalance;

            // distribute to limit
            // TODO: Extract and explain precision calculations.
            int debtAmount = (int(int128(self.debtDist.totalShares)) *
                (poolMaxShareValue - self.debtDist.valuePerShare / 1e9)) / 1e18;

            self.debtDist.distributeValue(debtAmount);

            // sanity
            //require(self.debtDist.valuePerShare/1e9 == poolMaxShareValue, "distribution calculation is borked");

            distributedMarketBalance += debtAmount;
            outstandingMarketBalance = targetBalance - distributedMarketBalance;

            // sanity
            require(self.debtDist.getActorShares(bytes32(uint(heapNode.id))) > 0, "no shares on actor removal");

            // detach market from pool (the pool will remain "detached" until the pool manager specifies a new debtDist)

            // TODO: Abstracted to remove stack too deep errors.
            // int newPoolDebt = self.debtDist.updateActorShares(bytes32(poolId), 0);
            self.poolPendingDebt[uint128(heapNode.id)] += self.debtDist.updateActorShares(bytes32(uint(heapNode.id)), 0);

            // note: we don't have to update the capacity because pool max share value - valuePerShare = 0, so no change
            // and conceptually it makes sense because this pools contribution to the capacity should have been used at this point

            if (self.debtDist.totalShares == 0) {
                // we just popped the last pool, can't move the market balance any higher
                self.lastDistributedMarketBalance = int128(distributedMarketBalance);
                return;
            }

            targetDebtPerDebtShare =
                self.debtDist.valuePerShare +
                ((outstandingMarketBalance * MathUtil.INT_UNIT) / int128(self.debtDist.totalShares));
        }

        outstandingMarketBalance = targetBalance - distributedMarketBalance;
        self.debtDist.distributeValue(outstandingMarketBalance);

        self.lastDistributedMarketBalance = int128(targetBalance);
    }

    // TODO: This is an attempt to extract logic from the function above in order to (1) Remove stack too deep errors and (2) Improve readability.
    // ...however, the stack too deep error remains (now in this function), and readability actually becomes worse because of how many variables need
    // ...to be passed between the functions.
    // function _processInRangePool(
    //     uint poolId,
    //     int128 poolMaxShareValue,
    //     int256 targetBalance,
    //     int256 distributedMarketBalance,
    //     int256 targetDebtPerDebtShare,
    // ) private returns (int256 newDistributedMarketBalance, int256 newOutstandingMarketBalance, int256 newTargetDebtPerDebtShare) {
    //     // distribute to limit
    //     // TODO: Extract and explain precision calculations.
    //     int debtAmount = (int(int128(self.debtDist.totalShares)) * (poolMaxShareValue - self.debtDist.valuePerShare / 1e9)) /
    //         1e18;

    //     self.debtDist.distributeValue(debtAmount);

    //     // sanity
    //     //require(self.debtDist.valuePerShare/1e9 == poolMaxShareValue, "distribution calculation is borked");

    //     newDistributedMarketBalance = distributedMarketBalance + debtAmount;
    //     newOutstandingMarketBalance = targetBalance - distributedMarketBalance;

    //     // sanity
    //     require(self.debtDist.getActorShares(bytes32(poolId)) > 0, "no shares on actor removal");

    //     // detach market from pool (the pool will remain "detached" until the pool manager specifies a new debtDist)

    //     int newPoolDebt = self.debtDist.updateActorShares(bytes32(poolId), 0);
    //     self.poolPendingDebt[uint128(poolId)] += newPoolDebt;

    //     // note: we don't have to update the capacity because pool max share value - valuePerShare = 0, so no change
    //     // and conceptually it makes sense because this pools contribution to the capacity should have been used at this point

    //     if (self.debtDist.totalShares == 0) {
    //         // we just popped the last pool, can't move the market balance any higher
    //         self.lastDistributedMarketBalance = int128(distributedMarketBalance);
    //         return;
    //     }

    //     targetDebtPerDebtShare =
    //         self.debtDist.valuePerShare +
    //         ((outstandingMarketBalance * MathUtil.INT_UNIT) / int128(self.debtDist.totalShares));
    // }
}
