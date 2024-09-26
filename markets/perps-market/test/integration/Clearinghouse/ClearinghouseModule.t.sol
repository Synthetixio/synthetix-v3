pragma solidity >=0.8.11 <0.9.0;

import {Test, console2} from "forge-std/Test.sol";
import {ClearinghouseModule} from "../../../contracts/modules/ClearinghouseModule.sol";

contract ClearinghouseModuleTest {
ClearinghouseModule clearingHouse;
}

contract CancelOrders is ClearinghouseModuleTest {
    function setUp() public {
        clearingHouse = new ClearinghouseModule();
    }
    function test_CancelsSingleOrders(uint256 _nonce) public {

    }
}