//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/external/IPythVerifier.sol";

contract PythVerifierMock is IPythVerifier {
    int64 public price;

    function setPrice(int64 newPrice) external {
        price = newPrice;
    }

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
}
