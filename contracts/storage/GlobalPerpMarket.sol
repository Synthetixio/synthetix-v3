pragma solidity 0.8.19;

library GlobalPerpMarket {
    struct Data {
        // Array of supported synth spot market ids useable as collateral for margin.
        uint128[] activeMarketIds;
    }
    bytes32 private constant SLOT_NAME = keccak256(abi.encode("io.synthetix.bfp-market.GlobalPerpMarket"));

    function load() internal pure returns (GlobalPerpMarket.Data storage d) {
        bytes32 s = SLOT_NAME;

        assembly {
            d.slot := s
        }
    }
}
