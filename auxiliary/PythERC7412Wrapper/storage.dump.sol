// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.11<0.9.0;

// @custom:artifact @synthetixio/core-contracts/contracts/utils/DecimalMath.sol:DecimalMath
library DecimalMath {
    uint256 public constant UNIT = 1e18;
    int256 public constant UNIT_INT = int256(UNIT);
    uint128 public constant UNIT_UINT128 = uint128(UNIT);
    int128 public constant UNIT_INT128 = int128(UNIT_INT);
    uint256 public constant UNIT_PRECISE = 1e27;
    int256 public constant UNIT_PRECISE_INT = int256(UNIT_PRECISE);
    int128 public constant UNIT_PRECISE_INT128 = int128(UNIT_PRECISE_INT);
    uint256 public constant PRECISION_FACTOR = 9;
}

// @custom:artifact @synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol:PythStructs
contract PythStructs {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }
    struct PriceFeed {
        bytes32 id;
        Price price;
        Price emaPrice;
    }
}

// @custom:artifact contracts/PythERC7412Wrapper.sol:PythERC7412Wrapper
contract PythERC7412Wrapper {
    int256 private constant PRECISION = 18;
}

// @custom:artifact contracts/storage/Price.sol:Price
library Price {
    struct Data {
        mapping(uint64 => PythStructs.Price) benchmarkPrices;
    }
    function load(bytes32 priceId) internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.pyth-erc7412-wrapper.price", priceId));
        assembly {
            price.slot := s
        }
    }
}
