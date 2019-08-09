const BN = require('bn.js');
const chai = require('chai');
chai.use(require('bn-chai')(BN));
expect = chai.expect;

const _require = require('app-root-path').require;
const { setupCAmpl, toAmplDecimals, invokeRebase, INITIAL_EXCHANGE_RATE } = _require('/test/helper');

const AMPLS_SUPPLIED = toAmplDecimals(2000000); // 2m
const MINT_cAMPL_SUPPLY = AMPLS_SUPPLIED.div(INITIAL_EXCHANGE_RATE);

let ampl, cAmpl, owner, anotherAccount;
async function setupContractAndAccounts (accounts) {
  owner = accounts[0];
  anotherAccount = accounts[8];
  [ampl, cAmpl] = await setupCAmpl(accounts);
}

contract('CAmpl:mint', function (accounts) {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
    await ampl.approve(cAmpl.address, AMPLS_SUPPLIED);
    await ampl.transfer(anotherAccount, AMPLS_SUPPLIED.mul(new BN(2)));
    await cAmpl.mint(AMPLS_SUPPLIED, {from:owner});
  });

  // exchangeRate = (totalCash + totalBorrows - totalReserves) / totalSupply
  // NOTE: if Rebases increases supply, then total cash increases thus the exchange rate
  // mintTokens = mintAmount / exchangeRate
  // If exchangeRate increase by 10%, for the same mintAmount mintTokens reduces by 9.09..%
  // If exchangeRate decreases by 10%, for the same mintAmount mintTokens increases by 11.11..%
  describe('when rebase increases AMPL supply by 10%', function () {
    it('should mint fewer cAmpls after rebase', async function () {
      await invokeRebase(ampl, 10);
      await ampl.approve(cAmpl.address, AMPLS_SUPPLIED, {from:anotherAccount});
      await cAmpl.mint(AMPLS_SUPPLIED, {from:anotherAccount});
      expect(await cAmpl.balanceOf.call(owner)).to.eq.BN(MINT_cAMPL_SUPPLY);
      expect(await cAmpl.balanceOf.call(anotherAccount)).to.eq.BN("1818181818181818");
    });
  });

  describe('when rebase decreases AMPL supply by 10%', function () {
    it('should mint more cAmpls after rebase', async function () {
      await invokeRebase(ampl, -10);
      await ampl.approve(cAmpl.address, AMPLS_SUPPLIED, {from:anotherAccount});
      await cAmpl.mint(AMPLS_SUPPLIED, {from:anotherAccount});
      expect(await cAmpl.balanceOf.call(owner)).to.eq.BN(MINT_cAMPL_SUPPLY);
      expect(await cAmpl.balanceOf.call(anotherAccount)).to.eq.BN("2222222222222222");
    });
  });

  describe('when rebase does not change AMPL supply', function () {
    it('should mint the same number of cAmpls after rebase', async function () {
      await invokeRebase(ampl, 0);
      await ampl.approve(cAmpl.address, AMPLS_SUPPLIED, {from:anotherAccount});
      await cAmpl.mint(MINT_cAMPL_SUPPLY, {from:anotherAccount});
      expect(await cAmpl.balanceOf.call(owner)).to.eq.BN(MINT_cAMPL_SUPPLY);
      expect(await cAmpl.balanceOf.call(anotherAccount)).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
  });
});
