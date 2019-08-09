const BN = require('bn.js');
const chai = require('chai');
chai.use(require('bn-chai')(BN));
expect = chai.expect;

const _require = require('app-root-path').require;
const { setupCAmpl, toAmplDecimals, invokeRebase, INITIAL_EXCHANGE_RATE } = _require('/test/helper');

const AMPLS_SUPPLIED = toAmplDecimals(2000000); // 2m

let ampl, cAmpl, owner, mintCamplSupply;
async function setupContractAndAccounts (accounts) {
  owner = accounts[0];
  [ampl, cAmpl] = await setupCAmpl(accounts);
}

contract('CAmpl:redeem', function (accounts) {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
    await ampl.approve(cAmpl.address, AMPLS_SUPPLIED);
    await cAmpl.mint(AMPLS_SUPPLIED, {from:owner});
    mintCamplSupply = await cAmpl.balanceOf(owner)
  });

  // exchangeRate = (totalCash + totalBorrows - totalReserves) / totalSupply
  // NOTE: if Rebases increases supply, then total cash increases thus the exchange rate
  // redeemAmount = redeemTokensIn x exchangeRateCurrent
  // If exchangeRate increase by 10%, for the same redeemTokensIn redeemAmount increases by 10%
  // If exchangeRate decreases by 10%, for the same redeemTokensIn redeemAmount decreases by 10%
  describe('when rebase increases AMPL supply by 10%', function () {
    it('should redeem 10% more AMPLs', async function() {
      await invokeRebase(ampl, 10);
      const b = await ampl.balanceOf(owner);
      await cAmpl.redeem(mintCamplSupply);
      const b_ = await ampl.balanceOf(owner);
      expect(b_.sub(b)).to.eq.BN(toAmplDecimals(2200000));
    });
  });

  describe('when rebase decreases AMPL supply by 10%', function () {
    it('should redeem 10% fewer AMPLs', async function() {
      await invokeRebase(ampl, -10);
      const b = await ampl.balanceOf(owner);
      await cAmpl.redeem(mintCamplSupply);
      const b_ = await ampl.balanceOf(owner);
      expect(b_.sub(b)).to.eq.BN(toAmplDecimals(1800000));
    });
  });

  describe('when rebase does not change AMPL supply', function () {
    it('should redeem the minted number of AMPLs', async function() {
      await invokeRebase(ampl, 0);
      const b = await ampl.balanceOf(owner);
      await cAmpl.redeem(mintCamplSupply);
      const b_ = await ampl.balanceOf(owner);
      expect(b_.sub(b)).to.eq.BN(AMPLS_SUPPLIED);
    });
  });
});
