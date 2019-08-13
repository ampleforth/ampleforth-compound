const BN = require('bn.js');
const chai = require('chai');
chai.use(require('bn-chai')(BN));
expect = chai.expect;

const _require = require('app-root-path').require;
const { setupCAmpl, toAmplDecimals, invokeRebase, INITIAL_EXCHANGE_RATE } = _require('/test/helper');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

const AMPLS_SUPPLIED = toAmplDecimals(2000000); // 2m
const AMPLS_BORROWED = toAmplDecimals(1500000); // 1.5m
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

  describe('when utilization ratio is 0', function () {
    // supplier gets all of the rebase rewards or losses
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

  describe('when utilization ratio > 0', function () {
    beforeEach(async function(){
      // 75% of cash is borrowed
      await cAmpl.borrow(AMPLS_BORROWED, {from: anotherAccount});
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
        // NOTE: Ideally, this needs to be exactly 2.05m AMPL but the difference arises due to
        // precision loss on conversion between cAmpl balances to Ampl balances
        // current value is 2,050,000.09 AMPL
        expect(await cAmpl.balanceOfUnderlying.call(owner)).to.eq.BN("2050000098319690");
        expect(await ampl.balanceOf.call(cAmpl.address)).to.eq.BN(toAmplDecimals(550000));
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
        // NOTE: Ideally, this needs to be exactly 1.95m AMPL
        // current value is 1,950,000.10 AMPL
        expect(await cAmpl.balanceOfUnderlying.call(owner)).to.eq.BN("1950000101532314");
        expect(await ampl.balanceOf.call(cAmpl.address)).to.eq.BN(toAmplDecimals(450000));
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
        expect(await cAmpl.balanceOfUnderlying.call(owner)).to.eq.BN("2000000099885844");
        expect(await ampl.balanceOf.call(cAmpl.address)).to.eq.BN(toAmplDecimals(500000));
      });
    });
  });
});
