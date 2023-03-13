//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/external/IPythVerifier.sol";
import "../interfaces/external/IChainlinkVerifier.sol";

contract OracleVerifierMock is IPythVerifier, IChainlinkVerifier {
    int64 public price;

    function setPrice(int64 newPrice) external {
        price = newPrice;
    }

    // Pyth verifier
    function parsePriceFeedUpdates(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable override returns (IPythVerifier.PriceFeed[] memory priceFeeds) {
        priceFeeds = new IPythVerifier.PriceFeed[](1);

        priceFeeds[0] = IPythVerifier.PriceFeed({
            id: priceIds[0],
            price: IPythVerifier.Price({
                price: price,
                conf: 0,
                expo: 0,
                publishTime: minPublishTime
            }),
            emaPrice: IPythVerifier.Price({
                price: price,
                conf: 0,
                expo: 0,
                publishTime: minPublishTime
            })
        });
    }

    // Chainlink verifier
    function verify(
        bytes memory chainlinkBlob
    ) external view override returns (bytes memory verifierResponse) {
        // solhint-disable-next-line numcast/safe-cast
        int192 priceFormatted = int192(price) * 10 ** 18;
        verifierResponse = abi.encode("ETH-USD", block.timestamp, 10, priceFormatted);
    }

    function getUpdateFee(uint updateDataSize) external view override returns (uint) {
        return 1;
    }
}
