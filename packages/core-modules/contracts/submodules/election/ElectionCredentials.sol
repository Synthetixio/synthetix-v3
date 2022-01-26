//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../../tokens/CouncilToken.sol";
import "./ElectionBase.sol";

contract ElectionCredentials is ElectionBase {
    function _createCouncilToken(string memory tokenName, string memory tokenSymbol) internal {
        ElectionStore storage store = _electionStore();

        CouncilToken firstImplementation = new CouncilToken();

        UUPSProxy proxy = new UUPSProxy(address(firstImplementation));
        address proxyAddress = address(proxy);

        CouncilToken token = CouncilToken(proxyAddress);

        token.nominateNewOwner(address(this));
        token.acceptOwnership();

        token.initialize(tokenName, tokenSymbol);

        store.councilToken = proxyAddress;
    }
}
