pragma solidity ^0.5.16;

import {ComptrollerG2} from "compound-protocol/contracts/ComptrollerG2.sol";

contract MockComptroller is ComptrollerG2 {
    function borrowAllowed(
        address cToken,
        address borrower,
        uint256 borrowAmount
    ) external returns (uint256) {
        return 0;
    }
}
