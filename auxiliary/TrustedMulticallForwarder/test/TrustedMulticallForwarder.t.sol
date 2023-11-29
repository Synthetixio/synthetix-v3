// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "../lib/forge-std/src/Test.sol";
import {Vm} from "../lib/forge-std/src/Vm.sol";

import {
    TrustedMulticallForwarder,
    ERC2771Forwarder,
    Address
} from "../src/TrustedMulticallForwarder.sol";

contract ERC2771Example {
    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return true;
    }

    function ping() public payable returns (string memory) {
        return "pong";
    }
}

contract TrustedMulticallForwarderTest is Test {
    // contract(s)
    TrustedMulticallForwarder internal trustedMulticallForwarder;
    ERC2771Example internal erc2771Example;

    // actor(s)
    address internal signer;
    uint256 internal signerPrivateKey = 0x1;
    address internal badSigner;
    uint256 internal badSignerPrivateKey = 0x2;

    function setUp() public {
        // deploy contract(s)
        trustedMulticallForwarder = new TrustedMulticallForwarder();
        erc2771Example = new ERC2771Example();

        // initialize actor specific state
        signer = vm.addr(signerPrivateKey);
        badSigner = vm.addr(badSignerPrivateKey);
    }
}

contract ExecuteBatch is TrustedMulticallForwarderTest {
    bytes32 private constant _TYPE_HASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 internal constant _FORWARD_REQUEST_TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
    );

    function getForwardRequestDataSignatureRaw(
        ERC2771Forwarder.ForwardRequestData memory request,
        uint256 nonce,
        uint256 privateKey,
        bytes32 domainSeparator
    ) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 msgHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                keccak256(
                    abi.encode(
                        _FORWARD_REQUEST_TYPEHASH,
                        request.from,
                        request.to,
                        request.value,
                        request.gas,
                        nonce,
                        request.deadline,
                        keccak256(request.data)
                    )
                )
            )
        );

        (v, r, s) = vm.sign(privateKey, msgHash);
    }

    function getForwardRequestDataSignature(
        ERC2771Forwarder.ForwardRequestData memory request,
        uint256 nonce,
        uint256 privateKey,
        bytes32 domainSeparator
    ) internal pure returns (bytes memory sig) {
        (uint8 v, bytes32 r, bytes32 s) = getForwardRequestDataSignatureRaw(
            request, nonce, privateKey, domainSeparator
        );
        return bytes.concat(r, s, bytes1(v));
    }

    function test_executeBatch() public {
        // tx details
        uint256 value = 1 ether;
        uint256 gas = 1 ether;

        // prepare forward request data (with empty signature)
        ERC2771Forwarder.ForwardRequestData memory request = ERC2771Forwarder
            .ForwardRequestData({
            from: address(signer),
            to: address(erc2771Example),
            value: value,
            gas: gas,
            deadline: type(uint48).max,
            data: abi.encodeWithSelector(ERC2771Example.ping.selector),
            signature: bytes("") // initially empty
        });

        // define domain separator
        bytes32 domainSeparator = keccak256(
            abi.encode(
                _TYPE_HASH,
                keccak256(bytes("trusted-multicall-forwarder")),
                keccak256(bytes("1")),
                block.chainid,
                address(trustedMulticallForwarder)
            )
        );

        // sign forward request data
        bytes memory signature = getForwardRequestDataSignature(
            request,
            trustedMulticallForwarder.nonces(address(signer)),
            signerPrivateKey,
            domainSeparator
        );

        // update forward request data object with signature
        request.signature = signature;

        // define batch of forward requests
        ERC2771Forwarder.ForwardRequestData[] memory batch =
            new ERC2771Forwarder.ForwardRequestData[](1);
        batch[0] = request;

        // execute batch
        TrustedMulticallForwarder.Result[] memory results =
        trustedMulticallForwarder.executeBatch{value: value, gas: gas}({
            requests: batch
        });

        // check results
        assertEq(results.length, 1);
        assertEq(results[0].success, true);
        assertEq(results[0].returnData, abi.encode("pong"));
    }

    function test_executeBatch_invalid_signature() public {
        // tx details
        uint256 value = 1 ether;
        uint256 gas = 1 ether;

        // prepare forward request data (with empty signature)
        ERC2771Forwarder.ForwardRequestData memory request = ERC2771Forwarder
            .ForwardRequestData({
            from: address(signer),
            to: address(erc2771Example),
            value: value,
            gas: gas,
            deadline: type(uint48).max,
            data: abi.encodeWithSelector(ERC2771Example.ping.selector),
            signature: bytes("") // initially empty
        });

        // define domain separator
        bytes32 domainSeparator = keccak256(
            abi.encode(
                _TYPE_HASH,
                keccak256(bytes("trusted-multicall-forwarder")),
                keccak256(bytes("1")),
                block.chainid,
                address(trustedMulticallForwarder)
            )
        );

        // sign forward request data as bad signer
        bytes memory invalidSignature = getForwardRequestDataSignature(
            request,
            trustedMulticallForwarder.nonces(address(signer)),
            badSignerPrivateKey, // bad signer
            domainSeparator
        );

        // update forward request data object with signature
        request.signature = invalidSignature;

        // define batch of forward requests
        ERC2771Forwarder.ForwardRequestData[] memory batch =
            new ERC2771Forwarder.ForwardRequestData[](1);
        batch[0] = request;

        // execute batch
        vm.expectRevert(Address.FailedInnerCall.selector);
        TrustedMulticallForwarder.Result[] memory results =
        trustedMulticallForwarder.executeBatch{value: value, gas: gas}({
            requests: batch
        });
    }
}
