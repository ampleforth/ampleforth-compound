const BN = require('bn.js');
const chai = require('chai');
chai.use(require('bn-chai')(BN));
expect = chai.expect;

const _require = require('app-root-path').require;
const { setupCAmpl, toAmplDecimals, invokeRebase, INITIAL_EXCHANGE_RATE } = _require('/test/helper');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

const AMPLS_SUPPLIED = toAmplDecimals(2000000); // 2m

let ampl, cAmpl, owner, anotherAccount, initCash;
async function setupContractAndAccounts (accounts) {
  owner = accounts[0];
  anotherAccount = accounts[8];
  [ampl, cAmpl] = await setupCAmpl(accounts);
}

contract('CAmpl:borrowRepay', function (accounts) {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
    await ampl.approve(cAmpl.address, AMPLS_SUPPLIED);
    await cAmpl.mint(AMPLS_SUPPLIED, {from:owner});
  });

  describe('A: brrows 1m AMPL', function(){
    beforeEach(async function(){
      expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(0);
      await cAmpl.borrow(toAmplDecimals(1000000), {from: anotherAccount});
    });

    it('should increase A\'s AMPL balance', async function(){
      expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(1000000));
    });

    describe('After 1d rebase increases supply by 100%, A repays borrow', function(){
      beforeEach(async function(){
        await chain.waitForNBlocks(6000);
        await invokeRebase(ampl, 100); // +100% supply
        await cAmpl.accrueInterest();
      });

      it('should keep the profits from rebase', async function(){
        // Interst accrued is around 256.93 AMPL
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(2000000));
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN("1000256934931506");

        await ampl.approve(cAmpl.address, AMPLS_SUPPLIED, {from: anotherAccount});
        await cAmpl.repayBorrow(-1, {from: anotherAccount}); // Repay everything

        // Balance after repaying 999,742.97 AMPL
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN(0);
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN("999742979423539");
      });
    });

    describe('After 1d rebase decreases supply by 50%, A repays borrow', function(){
      beforeEach(async function(){
        await chain.waitForNBlocks(6000);
        await invokeRebase(ampl, -50); // -50% supply
        await cAmpl.accrueInterest();
      });

      it('should pay for the loss from rebase', async function(){
        // Interst accrued is around 371.1 AMPL
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(500000));
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN("1000371128234396");

        // borrow {500372} AMPL to repay the loan, account balance 1,000,372 AMPL
        await ampl.transfer(anotherAccount, toAmplDecimals(500372));
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(1000372));
        await ampl.approve(cAmpl.address, toAmplDecimals(1000372), {from: anotherAccount});
        await cAmpl.repayBorrow(-1, {from: anotherAccount}); // Repay everything

        // Balance after repaying 0.68 AMPL
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN(0);
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(686180352);
      });
    });
  });
});
