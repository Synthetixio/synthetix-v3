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
    function test_CancelsSingleOrders(uint256 _nonce) public {
        nonces.push(_nonce);

        vm.expectEmit();
        emit IClearinghouse.OrdersCanceled(1, nonces);
        clearingHouse.cancelOrders(1, nonces);
    }
}
