const BN = require('bn.js');
const chai = require('chai');
chai.use(require('bn-chai')(BN));
expect = chai.expect;

const _require = require('app-root-path').require;
const { setupCAmpl, toAmplDecimals, invokeRebase, INITIAL_EXCHANGE_RATE } = _require('/test/helper');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

const AMPLS_SUPPLIED = toAmplDecimals(2000000); // 2m
const MINT_cAMPL_SUPPLY = AMPLS_SUPPLIED.div(INITIAL_EXCHANGE_RATE);

let ampl, cAmpl, owner, anotherAccount;
async function setupContractAndAccounts (accounts) {
  owner = accounts[0];
  anotherAccount = accounts[8];
  [ampl, cAmpl] = await setupCAmpl(accounts);
}

contract('CAmpl', function (accounts) {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
    await ampl.approve(cAmpl.address, AMPLS_SUPPLIED);
    await cAmpl.mint(AMPLS_SUPPLIED, {from:owner});
  });

  describe('when rebase increases AMPL supply', function () {
    beforeEach(async function(){
      await invokeRebase(ampl, 10); // +10% supply
    });
    it('should NOT update the totalSupply', async function() {
      expect(await cAmpl.totalSupply.call()).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should NOT update the cAmpl balance', async function () {
      expect(await cAmpl.balanceOf.call(owner)).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should update the underlying ampl balance', async function () {
      expect(await cAmpl.balanceOfUnderlying.call(owner)).to.eq.BN(toAmplDecimals(2200000));
      expect(await ampl.balanceOf.call(cAmpl.address)).to.eq.BN(toAmplDecimals(2200000));
    });
  });

  describe('when rebase decreases AMPL supply', function () {
    beforeEach(async function(){
      await invokeRebase(ampl, -10); // -10% supply
    });
    it('should NOT update the totalSupply', async function() {
      expect(await cAmpl.totalSupply.call()).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should NOT update the cAmpl balance', async function () {
      expect(await cAmpl.balanceOf.call(owner)).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should update the underlying ampl balance', async function () {
      expect(await cAmpl.balanceOfUnderlying.call(owner)).to.eq.BN(toAmplDecimals(1800000));
      expect(await ampl.balanceOf.call(cAmpl.address)).to.eq.BN(toAmplDecimals(1800000));
    });
  });

  describe('when rebase does NOT change AMPL supply', function () {
    beforeEach(async function(){
      await invokeRebase(ampl, 0);
    });
    it('should NOT update the totalSupply', async function() {
      expect(await cAmpl.totalSupply.call()).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should NOT update the cAmpl balance', async function () {
      expect(await cAmpl.balanceOf.call(owner)).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should update the underlying ampl balance', async function () {
      expect(await cAmpl.balanceOfUnderlying.call(owner)).to.eq.BN(AMPLS_SUPPLIED);
      expect(await ampl.balanceOf.call(cAmpl.address)).to.eq.BN(AMPLS_SUPPLIED);
    });
  });
});
