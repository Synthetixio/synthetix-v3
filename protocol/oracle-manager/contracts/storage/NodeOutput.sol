//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library NodeOutput {
    struct Data {
        /**
         * @dev price returned from the oracle node
         */
        int256 price;
        /**
         * @dev timestamp returned from the oracle node
         */
        uint256 timestamp;
        /**
         * @dev empty slot for later usage
         */
        // solhint-disable-next-line private-vars-leading-underscore
        uint256 __slotAvailableForFutureUse1;
        /**
         * @dev empty slot for later usage
         */
        // solhint-disable-next-line private-vars-leading-underscore
        uint256 __slotAvailableForFutureUse2;
    }
}
