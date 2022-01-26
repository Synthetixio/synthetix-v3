//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../../tokens/CouncilToken.sol";
import "./ElectionBase.sol";

contract ElectionCredentials is ElectionBase {
    using SetUtil for SetUtil.AddressSet;

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

    function _addToCouncil(address newMember) internal {
        SetUtil.AddressSet storage members = _getCurrentEpoch().councilMembers;

        if (members.contains(newMember)) {
            revert AlreadyACouncilMember();
        }

        members.add(newMember);

        uint tokenId = members.length() - 1;
        _mintCouncilToken(newMember, tokenId);
    }

    function _removeFromCouncil(address member) internal {
        SetUtil.AddressSet storage members = _getCurrentEpoch().councilMembers;

        if (!members.contains(member)) {
            revert NotACouncilMember();
        }

        // TODO
    }

    function _mintCouncilToken(address target, uint tokenId) private {
        _getCouncilToken().mint(target, tokenId);
    }

    function _getCouncilToken() internal view returns (CouncilToken) {
        return CouncilToken(_electionStore().councilToken);
    }
}
