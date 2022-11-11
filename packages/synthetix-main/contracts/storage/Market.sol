//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "@synthetixio/core-contracts/contracts/utils/HeapUtil.sol";

import "./Distribution.sol";
import "./CollateralConfiguration.sol";

import "../interfaces/external/IMarket.sol";

/**
 * @title TODO The Market object connects external contracts that implement the `IMarket` interface to the system, thus providing them with liquidity, and exposing the system to the market's debts and obligations.
 *
 * The Market object's main responsibility is to track collateral provided by the pools that support the market, and to trace their debt back to such pools.
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
         * @dev External contract address of the market that implements the `IMarket` interface, which this Market objects wraps.
         *
         * Note: This object is how the system tracks the market. The actual market is external to the system, i.e. its own contract.
         */
        address marketAddress;
        /**
         * @dev TODO Issuance can be seen as how much USD the Market "has issued", or has asked the system to mint.
         *
         * More precisely it can be seen as the net difference between the USD burnt and the USD minted by the market.
         * More issuance means that the market owes more USD to the system.
         *
         * A market burns USD when users deposit it in exchange for some asset that the market offers.
         * The Market object calls `MarketManager.depositUSD()`, which burns the USD, and decreases its issuance.
         *
         * A market mints USD when users return the asset that the market offered and thus withdraw their USD.
         * The Market object calls `MarketManager.withdrawUSD()`, which mints the USD, and increases its issuance.
         *
         * Instead of burning, the Market object could transfer USD to and from the MarketManager, but minting and burning takes the USD out of circulation (doesn't affect `totalSupply`) thus simplifying accounting.
         *
         * How much USD a market can mint depends on how much credit capacity is given to the market by the pools that support it, and reflected in `Market.capacity`.
         *
         * TODO: Consider renaming this to netIssuance.
         */
        int128 issuance;
        /**
         * @dev TODO The total amount of USD that the market could withdraw, if it were to immediately unwrap all its positions.
         *
         * The Market's capacity increases when the market burns USD, i.e. when it deposits USD in the MarketManager.
         *
         * It decreases when the market mints USD, i.e. when it withdraws USD from the MarketManager.
         *
         * The Market's capacity also depends on how much credit is given to it by the pools that support it.
         *
         * TODO: How does reported debt play with this definition?
         *
         * TODO: Consider renaming to creditCapacity.
         */
        uint128 capacity;
        /**
         * @dev TODO The total balance that the market had the last time that its debt was distributed.
         *
         * A Market's debt is distributed when the reported debt of its associated external market is rolled into the pools that provide liquidity to it.
         */
        int128 lastDistributedMarketBalance;
        /**
         * @dev TODO An array of pools for which the market has not yet hit its maximum credit capacity.
         *
         * Note: Used to disconnect pools from the market, when it goes above its maximum credit capacity.
         *
         * TODO: Check that the "max credit capacity" naming is consistent with what's actually on the code.
         *
         * TODO: Comment on why a heap data structure is used here.
         */
        HeapUtil.Data inRangePools;
        /**
         * @dev TODO An array of pools for which the market has hit its maximum credit capacity.
         *
         * Note: Used to reconnect pools to the market, when it falls back below its maximum credit capacity.
         *
         * TODO: Comment on why a heap data structure is used here.
         */
        HeapUtil.Data outRangePools;
        /**
         * @dev TODO A market's debt distribution connects markets to the debt distribution chain, in this case pools. Pools are actors in the market's debt distribution, where the amount of shares they possess depends on the amount of collateral they provide to the market. The value per share of this distribution depends on the total debt or balance of the market (netIssuance + reportedDebt).
         *
         * The debt distribution chain will move debt from the market into its connected pools.
         *
         * Actors: Pools.
         * Shares: (TODO is it 1:1 or proportional) The USD denominated credit capacity that the pool provides to the market.
         * Value per share: TODO Debt per dollar of credit that the associated external market accrues.
         */
        Distribution.Data debtDist;
        /**
         * @dev TODO
         *
         * TODO: Understand adjustVaultShares() first.
         */
        mapping(uint128 => int) poolPendingDebt;
        /**
         * @dev TODO Array of entries of market provided collateral.
         *
         * Markets may obtain additional liquidity, beyond that coming from stakers, by providing their own collateral.
         *
         * TODO: Rename to depositedCollaterals?
         */
        DepositedCollateral[] depositedCollateral;
        /**
         * @dev TODO The maximum amount of market provided collateral, per type, that this market can deposit.
         */
        mapping(address => uint) maximumDepositable;
    }

    /**
     * @dev TODO Data structure that allows the Market to track the amount of market provided collateral, per type.
     */
    struct DepositedCollateral {
        address collateralType;
        uint amount;
    }

    /**
     * @dev Returns the market stored at the specified market id.
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
     * @dev Returns an array of market ids representing the markets linked to the system at a particular external contract address.
     *
     * Note: A contract implementing the `IMarket` interface may represent more than just one market, and thus several market ids could be associated to a single external contract address.
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
     * TODO: Use constants for storage slots, here and possible everywhere in the code.
     */
    function loadLastId() internal view returns (uint128 data) {
        bytes32 s = keccak256(abi.encode("Market_lastId"));
        assembly {
            data := sload(s)
        }
    }

    /**
     * @dev Caches the id of the last market that was created.
     *
     * Used to automatically generate a new id when a market is created.
     *
     * TODO: Use constants for storage slots, here and possible everywhere in the code.
     */
    function storeLastId(uint128 newValue) internal {
        bytes32 s = keccak256(abi.encode("Market_lastId"));
        assembly {
            sstore(s, newValue)
        }
    }

    /**
     * @dev Given an external contract address representing an `IMarket`, creates a new id for the market, and tracks it internally in the system.
     *
     * The id used to track the market will be automatically assigned by the system according to the last id used.
     *
     * Note: If an external `IMarket` contract tracks several market ids, this function should be called for each market it tracks, resulting in multiple ids for the same address.
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
     * @dev TODO Queries the external market contract for the amount of debt it has issued.
     *
     * The reported debt of a market represents the amount of USD that the market would ask the system to mint, if all of its positions were to be immediately closed.
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
     *
     * SIP 309 markets can lock x amount of credit - use case: insurance market (read SIP)
     * If a pool config change decreases credit available to market AND amount is less - prevents pools from decreasing if resulting amount is below this value.
     */
    function getLockedLiquidity(Data storage self) internal view returns (uint) {
        return IMarket(self.marketAddress).locked(self.id);
    }

    /**
     * @dev TODO Returns the total balance of the market.
     *
     * A market's total balance represents its debt plus its issuance, and thus represents the total outstanding debt of the market.
     *
     * Example:
     * (1 EUR = 1.11 USD)
     * If an Euro market has received 100 USD to mint 90 EUR, its reported debt is 90 EUR or 100 USD, and its issuance is -100 USD.
     * Thus, its total balance is 100 USD of reported debt minus 100 USD of issuance, which is 0 USD.
     *
     * Additionally, the market's totalBalance might be affected by price fluctuations via reportedDebt, or fees.
     *
     * TODO: Consider renaming to totalDebt()? totalBalance is more correct, but totalDebt is easier to understand.
     */
    function totalBalance(Data storage self) internal view returns (int) {
        return int(getReportedDebt(self)) + self.issuance - int(getDepositedCollateralValue(self));
    }

    /**
     * @dev TODO Returns the USD value for the total amount of collateral provided by the market itself.
     *
     * Note: This is not liquidity provided by stakers through pools.
     *
     * See SIP 308.
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
     * @dev TODO Returns the amount of liquidity that a certain pool provides to the market.

     * This liquidity is obtained by reading the amount of shares that the pool has in the market's debt distribution, which in turn represents the amount of USD denominated credit capacity that the pool has provided to the market.
     */
    function getPoolLiquidity(Data storage self, uint128 poolId) internal view returns (uint) {
        return self.debtDist.getActorShares(bytes32(uint(poolId)));
    }

    /**
     * @dev TODO Given an amount of shares that represent USD liquidity from a pool, and a maximum value per share, returns the potential contribution to debt that these shares could accrue, if their value per share was to hit the maximum.
     *
     * TODO: Try to illustrate with an example why this could be useful...
     * 100 collateral, 50% coming to this market
     * In docs maxDebtPerDollarOfCollateral - here maxDebtPerShare
     * Goes from debt shares to credit capacity and applying the maxDebtPerDollarOfCollateral to that value.
     *
     * TODO: Explain how this is used.
     * TODO: If the term "capacity" refers to something other than `Market.capacity` then either this should use a different term, of the other one should.
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
     * @dev TODO Returns true if the market's current capacity is below the amount of locked liquidity.
     *
     * TODO: Should this be <=?
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

        // Get the current and last distributed market balances.
        // Note: The last distributed balance is cached at the end of this function's execution.
        int256 targetBalance = totalBalance(self);
        int256 distributedBalance = self.lastDistributedMarketBalance;
        int256 outstandingBalance = targetBalance - distributedBalance;

        // Calculate the target value per share of the distribution if it assimilated the market's outstanding balance.
        // TODO: Rename to targetValuePerShare.
        int256 targetDebtPerShare = _calculateOutstandingDebtPerShare(self, outstandingBalance);

        // TODO: Explain what this is, overall goal of the loop...
        // TODO: Consider moving this to a separate function?
        // this loop should rarely execute the body. When it does, it only executes once for each pool that passes the limit.
        // since `_distributeMarket` is not run for most pools, market users are not hit with any overhead as a result of this,
        // additionally,
        // TODO: If this is rarely entered, then should this be out of range pools? Prob. not, so this is likely entered frequently.
        // TODO: Refactor this loop's iteration conditions into something that regular mortals can read.
        for (
            uint i = 0;
            self.inRangePools.size() > 0 && -self.inRangePools.getMax().priority < targetDebtPerShare && i < maxIter;
            i++
        ) {
            // Get the in-range-pool with the highest maximum debt per share.
            // TODO: Understand why we're getting this max.
            HeapUtil.Node memory heapNode = self.inRangePools.extractMax();
            uint poolId = heapNode.id;
            // TODO: Rename (in all file) to "poolMaxDebtPerShare"?
            int128 poolMaxShareValue = -heapNode.priority;

            // TODO: Explain this...
            int256 debtAmount = _distributeDebtToLimit(self, poolMaxShareValue);

            // TODO: Remove if unused.
            // sanity
            //require(self.debtDist.valuePerShare/1e9 == poolMaxShareValue, "distribution calculation is borked");

            distributedBalance += debtAmount;
            outstandingBalance = targetBalance - distributedBalance;

            // TODO: Comment
            // sanity
            require(self.debtDist.getActorShares(bytes32(poolId)) > 0, "no shares on actor removal");

            // detach market from pool (the pool will remain "detached" until the pool manager specifies a new debtDist)

            // TODO: Explain...
            int newPoolDebt = self.debtDist.updateActorShares(bytes32(poolId), 0);
            self.poolPendingDebt[uint128(poolId)] += newPoolDebt;

            // note: we don't have to update the capacity because pool max share value - valuePerShare = 0, so no change
            // and conceptually it makes sense because this pools contribution to the capacity should have been used at this point

            if (self.debtDist.totalShares == 0) {
                // we just popped the last pool, can't move the market balance any higher
                self.lastDistributedMarketBalance = int128(distributedBalance);
                return;
            }

            targetDebtPerShare =
                self.debtDist.valuePerShare +
                ((outstandingBalance * MathUtil.INT_UNIT) / int128(self.debtDist.totalShares));
        }

        outstandingBalance = targetBalance - distributedBalance;
        self.debtDist.distributeValue(outstandingBalance);

        self.lastDistributedMarketBalance = int128(targetBalance);
    }

    /**
     * @dev TODO
     */
    function _distributeDebtToLimit(Data storage self, int128 poolMaxShareValue) private returns (int debtAmount) {
        // distribute to limit
        // TODO: Extract and explain precision calculations.
        debtAmount =
            (int(int128(self.debtDist.totalShares)) * (poolMaxShareValue - self.debtDist.valuePerShare / 1e9)) /
            1e18;

        self.debtDist.distributeValue(debtAmount);
    }

    /**
     * @dev TODO Calculates the target value per share of the market's distribution, considering its outstanding balance, i.e. the market's obligations that haven't yet been transferred into the rest of the distribution chain.
     *
     * TODO: Understand and document scaling here.
     */
    function _calculateOutstandingDebtPerShare(Data storage self, int256 outstandingMarketBalance)
        private
        returns (int256 targetDebtPerShare)
    {
        // TODO: Use new function Distribution.getLowPrecisionValuePerShare().
        // Value per share is high precision (1e27), so downscale to 1e18.
        int128 lowPrecisionValuePerShare = self.debtDist.valuePerShare / 1e9;

        // TODO: Explain scaling.
        // TODO: Rename once scaling is understood.
        int256 xxxPrecisionOutstandingMarketBalance = outstandingMarketBalance * MathUtil.INT_UNIT;

        // Calculate the outstanding market balance per share.
        // TODO: Rename once scaling is understood.
        int256 xxxPrecisionOutstandingMarketBalancePerShare = xxxPrecisionOutstandingMarketBalance /
            int128(self.debtDist.totalShares);

        // The target value per share is the current value plus the change in value.
        targetDebtPerShare = lowPrecisionValuePerShare + xxxPrecisionOutstandingMarketBalancePerShare;
    }
}
