//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library LimitOrder {
    /**
     * @notice Gets thrown when a limit order is not on the right nonce
     */
    error LimitOrderInvalidNonce(uint128 accountId, uint256 invalidNonce, uint256 validNonce);

    bytes32 private constant _SLOT_LIMIT_ORDER =
        keccak256(abi.encode("io.synthetix.perps-market.LimitOrder"));

    struct Data {
        /**
         * @dev a mapping of account ids to their current order nonces.
         */
        mapping(uint128 => uint256) orderNonces;
    }

    /**
     * @notice Limit Order structured data.
     */
    struct SignedOrderRequest {
        /**
         * @dev Limit order account id.
         */
        uint128 accountId;
        /**
         * @dev Limit order market id.
         */
        uint256 marketId;
        /**
         * @dev Limit order relayer address.
         */
        address relayer;
        /**
         * @dev Limir order amount.
         */
        int256 amount;
        /**
         * @dev Limit order price.
         */
        uint256 price;
        /**
         * @dev Limit order expiration.
         */
        uint256 expiration;
        /**
         * @dev Limit order nonce.
         */
        uint256 nonce;
    }

    function load() internal pure returns (Data storage limitOrder) {
        bytes32 s = _SLOT_LIMIT_ORDER;
        assembly {
            limitOrder.slot := s
        }
    }

    function update(Data storage self, uint128 accountId) internal {
        self.orderNonces[accountId] = self.orderNonces[accountId]++;
    }

    function checkNonce(Data storage self, uint128 accountId, uint256 nonce) internal view {
        if (self.orderNonces[accountId] != nonce) {
            revert LimitOrderInvalidNonce(accountId, nonce, self.orderNonces[accountId]);
        }
    }
}
