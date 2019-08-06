pragma solidity ^0.5.8;

import "./Compound/CErc20.sol";

contract CAmpl is CErc20 {
    constructor(
      address _token,
      ComptrollerInterface _comptroller,
      InterestRateModel _interestRateModel
    )
    CErc20(
      _token,
      _comptroller,
      _interestRateModel,
      1 * (10 ** 18),
      "Compound Ampleforth",
      "cAMPL",
      9
    )
    public
    {}
}
