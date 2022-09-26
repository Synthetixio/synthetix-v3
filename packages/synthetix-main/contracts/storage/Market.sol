//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "@synthetixio/core-contracts/contracts/utils/HeapUtil.sol";

import "./Distribution.sol";

import "../interfaces/external/IMarket.sol";

import "hardhat/console.sol";

library Market {
    using Distribution for Distribution.Data;
    using HeapUtil for HeapUtil.Data;
    using MathUtil for uint256;

    error MarketNotFound(uint128 marketId);

    struct Data {
        /// @notice the id of this market
        uint128 id;
        /// @notice the address which is used by the market to communicate with the core system. Implements `IMarket` interface
        address marketAddress;
        /// @notice the difference between the USD burnt by the market, and the amount minted
        int128 issuance;
        /// @notice the total amount of USD that the market could withdraw right now
        uint128 capacity;
        /// @notice the amount of debt the last time the debt was distributed
        int128 lastMarketBalance;
        // used to disconnect pools from a market if it goes above a certain debt per debt share
        HeapUtil.Data inRangePools;
        // used to attach/reattach pools to a market if it goes below a certain debt per debt share
        HeapUtil.Data outRangePools;
        Distribution.Data debtDist;
        mapping(uint128 => int) poolPendingDebt;
    }

    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Market", id));
        assembly {
            data.slot := s
        }
    }

    function loadIdsByAddress(address addr) internal pure returns (uint[] storage data) {
        bytes32 s = keccak256(abi.encode("Market_idsByAddress", addr));
        assembly {
            data.slot := s
        }
    }

    function loadLastId() internal view returns (uint128 data) {
        bytes32 s = keccak256(abi.encode("Market_lastId"));
        assembly {
            data := sload(s)
        }
    }

    function storeLastId(uint128 newValue) internal {
        bytes32 s = keccak256(abi.encode("Market_lastId"));
        assembly {
            sstore(s, newValue)
        }
    }

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

    function getReportedDebt(Data storage self) internal view returns (uint) {
        return IMarket(self.marketAddress).reportedDebt(self.id);
    }

    function totalBalance(Data storage self) internal view returns (int) {
        return int(getReportedDebt(self)) + self.issuance;
    }

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

        console.log("ENTER REBALANCE");

        distributeDebt(self, 9999999999);

        return adjustVaultShares(self, poolId, amount, maxDebtShareValue);
    }

    function adjustVaultShares(
        Data storage self,
        uint128 poolId,
        uint newLiquidity,
        int newPoolMaxShareValue
    ) internal returns (int debtChange) {
        console.log("ENTER ADJUST SHARES", newLiquidity, uint(newPoolMaxShareValue));
        uint oldLiquidity = self.debtDist.getActorShares(bytes32(uint(poolId)));
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

        console.log("update shares", newLiquidity);

        debtChange = self.poolPendingDebt[poolId] + self.debtDist.updateActorShares(bytes32(uint(poolId)), newLiquidity);
        self.poolPendingDebt[poolId] = 0;

        // recalculate market capacity
        if (newPoolMaxShareValue > self.debtDist.valuePerShare / 1e9) {
            self.capacity += uint128(
                uint((newPoolMaxShareValue - self.debtDist.valuePerShare / 1e9)).mulDecimal(newLiquidity)
            );
        }

        if (oldPoolMaxShareValue > self.debtDist.valuePerShare / 1e9) {
            self.capacity -= uint128(
                uint((oldPoolMaxShareValue - self.debtDist.valuePerShare / 1e9)).mulDecimal(oldLiquidity)
            );
        }
    }

    // the second parameter exists to act as an escape hatch/discourage aginst griefing
    /**
     * Rotates recorded allocation of debt to any connected pools.
     * NOTE: this function should be called before any pool alters its liquidity allocation (see `rebalance` above)
     */
    function distributeDebt(Data storage self, uint maxIter) internal {
        if (self.debtDist.totalShares == 0) {
            // market cannot distribute (or accumulate) any debt when there are no shares
            console.log("didnt see any shares", uint(int(self.debtDist.valuePerShare / 1e9)));
            return;
        }

        // get the latest market balance
        int targetBalance = totalBalance(self);
        console.log("new target balance", uint(targetBalance));

        int curBalance = self.lastMarketBalance;

        int targetDebtPerDebtShare = self.debtDist.valuePerShare /
            1e9 +
            (((targetBalance - curBalance) * MathUtil.INT_UNIT) / int128(self.debtDist.totalShares));

        // this loop should rarely execute the body. When it does, it only executes once for each pool that passes the limit.
        // since `_distributeMarket` is not run for most pools, market users are not hit with any overhead as a result of this,
        // additionally,
        for (
            uint i = 0;
            self.inRangePools.size() > 0 && -self.inRangePools.getMax().priority < targetDebtPerDebtShare && i < maxIter;
            i++
        ) {
            HeapUtil.Node memory nextRemove = self.inRangePools.extractMax();

            // distribute to limit
            int debtAmount = (int(int128(self.debtDist.totalShares)) *
                (-nextRemove.priority - self.debtDist.valuePerShare / 1e9)) / 1e18;

            self.debtDist.distribute(debtAmount);

            // sanity
            //require(self.debtDist.valuePerShare/1e9 == -nextRemove.priority, "distribution calculation is borked");

            curBalance += debtAmount;

            // sanity
            require(self.debtDist.getActorShares(bytes32(uint(nextRemove.id))) > 0, "no shares on actor removal");

            // detach market from pool (the pool will remain "detached" until the pool manager specifies a new debtDist)

            int newPoolDebt = self.debtDist.updateActorShares(bytes32(uint(nextRemove.id)), 0);
            self.poolPendingDebt[nextRemove.id] += newPoolDebt;

            // note: we don't have to update the capacity because pool max share value - valuePerShare = 0, so no change
            // and conceptually it makes sense because this pools contribution to the capacity should have been used at this point

            if (self.debtDist.totalShares == 0) {
                // we just popped the last pool, can't move the market balance any higher
                self.lastMarketBalance = int128(curBalance);
                return;
            }

            targetDebtPerDebtShare =
                self.debtDist.valuePerShare +
                (((targetBalance - curBalance) * MathUtil.INT_UNIT) / int128(self.debtDist.totalShares));
        }

        self.debtDist.distribute(targetBalance - curBalance);
        self.lastMarketBalance = int128(targetBalance);
    }
}
