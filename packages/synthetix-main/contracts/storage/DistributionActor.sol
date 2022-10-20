//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Stores information for specific actors in a Distribution.
 */
library DistributionActor {
    struct Data {
        /**
         * @dev The actor's current number of shares in the associated distribution.
         */
        uint128 shares;
        /**
         * @dev The valuePerShare at the time that their number of shares was last altered.
         */
        int128 lastValuePerShare;
    }
}
