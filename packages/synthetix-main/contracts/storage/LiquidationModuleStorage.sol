//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ILiquidationModule.sol";

contract LiquidationModuleStorage {
    struct LiquidationModuleStore {
        mapping(bytes32 => CurvesLibrary.PolynomialCurve) liquidationCurves;
    }

    function _liquidationModuleStore() internal pure returns (LiquidationModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.liquidationmodule")) - 1)
            store.slot := 0x4bb341deb0ebc8ebdbadcce53ea1b8ef355fe539ca851ec9d632ae75685a6553
        }
    }
}
