//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Buyback configuration storage.
 */
library Buyback {
    struct Data {
        /**
         * @dev The premium % added to the oracle price.
         */
        uint256 premium;
        /**
         * @dev The ratio of the fees earned by the buyback contract.
         */
        uint256 snxFeeShare;
        /**
         * @dev The address of the oracle manager
         */
        address oracleManager;
        /**
         * @dev The snx oracle id
         */
        bytes32 snxNodeId;
        /**
         * @dev The address of the SNX token
         */
        address snxToken;
        /**
         * @dev The address of the USD token
         */
        address usdToken;
    }

    function load() internal pure returns (Data storage buyback) {
        bytes32 s = keccak256(abi.encode("io.synthetix.auxiliary.buyback-snx.Buyback"));
        assembly {
            buyback.slot := s
        }
    }
}
