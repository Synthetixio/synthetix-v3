//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FundModuleStorage {
    struct FundModuleStore {
        bool initialized;
        mapping(uint => PositionData) fundPositions; // positions by fundId
        mapping(uint => FundMetadata) funds; // fund metadata by fundId
    }

    struct Position {
        uint accountId;
        uint collateralType;
        uint collateralAmount;
        uint leverage;
        uint initialDebt; // how that works with amount adjustments?
    }

    struct FundMetadata {
        address owner;
    }

    // Account finances
    struct PositionData {
        // Id is keccak256(abi.encodePacked(stakedCollateral))
        mapping(uint => bytes32[]) positionIds; // position ids by accountId/collateralType/leverage
        mapping(bytes32 => Position) fundedPositions; // staked collateral data by stakedColalteralId
    }

    function _fundModuleStore() internal pure returns (FundModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundmodule")) - 1)
            store.slot := 0x777921625cac3385fe90fd55ec5b9c58ada192ff82f029c62116f9fddf316bcd
        }
    }
}
