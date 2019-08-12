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
    await ampl.transfer(anotherAccount, toAmplDecimals(1200000));
  });

  describe('A: borrows 1m AMPL', function(){
    beforeEach(async function(){
      // starts off with 1.2m AMPLS, borrows another 1m
      expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(1200000));
      await cAmpl.borrow(toAmplDecimals(1000000), {from: anotherAccount});
    });

    it('should increase A\'s AMPL balance', async function(){
      expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(2200000));
    });

    describe('After 1h rebase increases supply by 100%, A repays borrow', function(){
      beforeEach(async function(){
        await invokeRebase(ampl, 100); // +100% supply
        await chain.waitForNBlocks(240);
        await cAmpl.accrueInterest();
      });

      it('should keep the profits from rebase', async function(){
        // balance after rebase 4.4m
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(4400000));
        // Interest accrued is around 10.35 AMPL
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN("1000010359589041");

        await ampl.approve(cAmpl.address, toAmplDecimals(1000011), {from: anotherAccount});
        await cAmpl.repayBorrow(-1, {from: anotherAccount}); // Repay everything

        // Balance after repaying 3,399,989.55 AMPL
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN(0);
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN("3399989554793371");
      });
    });

    describe('After 1h rebase decreases supply by 50%, A repays borrow', function(){
      beforeEach(async function(){
        await invokeRebase(ampl, -50); // -50% supply
        await chain.waitForNBlocks(240);
        await cAmpl.accrueInterest();
      });

      it('should pay for the loss from rebase', async function(){
        // balance after rebase 1.1m
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(1100000));
        // Interest accrued is around 14.96 AMPL
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN("1000014963850837");

        await ampl.approve(cAmpl.address, toAmplDecimals(1000016), {from: anotherAccount});
        await cAmpl.repayBorrow(-1, {from: anotherAccount}); // Repay everything

        // Balance after repaying 99,984.9 AMPL
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN(0);
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(99984912478745);
      });
    });
  });
});
