//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library PerpCollateral {
    // --- Constants --- //

    bytes32 private constant _SLOT_NAMESPACE = keccak256(abi.encode("io.synthetix.bfp-market.PerpCollateral"));

    // --- Structs --- //

    struct CollateralType {
        // Oracle price feed node id.
        bytes32 oracleNodeId;
        // Maximum allowable deposited amount.
        uint128 maxAllowable;
    }

    // --- Storage --- //

    struct GlobalData {
        // {collateralAddress: CollateralType}.
        mapping(address => CollateralType) available;
        // Array of addresses of supported collaterals for iteration.
        address[] availableAddresses;
    }

    struct Data {
        // {collateralAddress: amount} (amount of collateral deposited into this account).
        mapping(address => uint256) available;
    }

    function load(uint128 accountId, uint128 marketId) internal pure returns (PerpCollateral.Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpCollateral", accountId, marketId));

        assembly {
            d.slot := s
        }
    }

    function load() internal pure returns (PerpCollateral.GlobalData storage d) {
        bytes32 s = _SLOT_NAMESPACE;

        assembly {
            d.slot := s
        }
    }

    // --- Member --- //

    /**
     * @dev Configure PerpCollateral with collateral types and their allowables.
     */
    function configure(
        address[] calldata collateralTypes,
        bytes32[] calldata oracleNodeIds,
        uint128[] calldata maxAllowables
    ) external {
        PerpCollateral.GlobalData storage config = PerpCollateral.load();

        // Clear existing collateral configuration to be replaced with new.
        uint256 existingCollateralLength = config.availableAddresses.length;
        for (uint256 i = 0; i < existingCollateralLength; ) {
            delete config.available[config.availableAddresses[i]];
            unchecked {
                i++;
            }
        }
        delete config.availableAddresses;

        // Update with passed in configuration.
        uint256 newCollateralLength = collateralTypes.length;
        address[] memory newAvailableAddresses = new address[](newCollateralLength);
        for (uint256 i = 0; i < newCollateralLength; ) {
            address collateralType = collateralTypes[i];
            config.available[collateralType] = CollateralType(oracleNodeIds[i], maxAllowables[i]);
            newAvailableAddresses[i] = collateralType;
            unchecked {
                i++;
            }
        }
        config.availableAddresses = newAvailableAddresses;
    }
}
