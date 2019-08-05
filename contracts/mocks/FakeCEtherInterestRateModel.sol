pragma solidity ^0.5.8;

import "../Compound/WhitePaperInterestRateModel.sol";

contract FakeCEtherInterestRateModel is WhitePaperInterestRateModel {
    constructor()
    WhitePaperInterestRateModel(
      0.02 * (10 ** 18),
      0.3 * (10 ** 18)
    )
    public
    {}
}