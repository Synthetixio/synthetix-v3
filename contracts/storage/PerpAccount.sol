//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library PerpAccount {
    struct Data {
        uint128 id;
        mapping(uint128 => uint256) collateral;
    }

    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.Account", id));

        assembly {
            account.slot := s
        }
    }
}
