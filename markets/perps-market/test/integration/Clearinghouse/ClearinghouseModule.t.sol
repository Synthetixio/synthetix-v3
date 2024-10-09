pragma solidity >=0.8.11 <0.9.0;

import {Test, console2} from "forge-std/Test.sol";
import {ClearinghouseModule} from "../../../contracts/modules/ClearinghouseModule.sol";
import {IClearinghouse} from "../../../contracts/interfaces/IClearinghouse.sol";

contract ClearinghouseModuleTest is Test {
    ClearinghouseModule clearingHouse;
    uint256[] nonces;
}

contract CancelOrders is ClearinghouseModuleTest {
    function setUp() public {
        clearingHouse = new ClearinghouseModule();
    }

    //TODO add account logic here and uncomment the account verification in ClearinghousModule
    function test_CancelsSingleOrders(uint256 _nonce1, uint256 _nonce2, uint256 _nonce3) public {
        nonces.push(_nonce1);
        nonces.push(_nonce2);
        nonces.push(_nonce3);

        vm.expectEmit();
        emit IClearinghouse.OrdersCanceled(1, nonces);
        clearingHouse.cancelOrders(1, nonces);

        bool result1 = clearingHouse.hasUnorderedNonceBeenUsed(1, _nonce1);
        assertTrue(result1);
        bool result2 = clearingHouse.hasUnorderedNonceBeenUsed(1, _nonce2);
        assertTrue(result2);
        bool result3 = clearingHouse.hasUnorderedNonceBeenUsed(1, _nonce3);
        assertTrue(result3);
    }

    function test_HashesOrders(uint256 randUint, int256 randInt, address randAdress, bytes32 randBytes) public {
        //TODO
        // IClearinghouse.Order memory order = Order()
    }
}  
