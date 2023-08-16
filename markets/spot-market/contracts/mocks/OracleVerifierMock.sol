//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

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
        // mention the variables in the block to prevent unused local variable warning
        updateData;
        maxPublishTime;

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
        // mention the variables in the block to prevent unused local variable warning
        chainlinkBlob;
        // solhint-disable-next-line numcast/safe-cast
        int192 priceFormatted = int192(price) * 10 ** 18;
        verifierResponse = abi.encode("ETH-USD", block.timestamp, 10, priceFormatted);
    }

    function getUpdateFee(uint256 updateDataSize) external view override returns (uint256) {
        // mention the variables in the block to prevent unused local variable warning
        updateDataSize;
        return 1;
    }
}
