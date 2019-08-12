pragma solidity ^0.5.8;

import "../Compound/Comptroller.sol";

contract FakeComptroller is Comptroller {
  function borrowAllowed(address cToken, address borrower, uint borrowAmount) external returns (uint) {
    return 0;
  }
}
