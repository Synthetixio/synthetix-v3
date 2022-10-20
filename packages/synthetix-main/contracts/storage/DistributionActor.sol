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
         * @dev The actor's last known value per share in the associated distribution.
         */
        int128 lastValuePerShare;
    }
}
