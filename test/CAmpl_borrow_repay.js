const BN = require('bn.js');
const chai = require('chai');
chai.use(require('bn-chai')(BN));
expect = chai.expect;

const _require = require('app-root-path').require;
const { setupCAmpl, toAmplDecimals, invokeRebase, INITIAL_EXCHANGE_RATE } = _require('/test/helper');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

const AMPLS_SUPPLIED = toAmplDecimals(1000000); // 1m

let ampl, cAmpl, owner, anotherAccount, mintSupply;
async function setupContractAndAccounts (accounts) {
  owner = accounts[0];
  anotherAccount = accounts[8];
  [ampl, cAmpl] = await setupCAmpl(accounts);
}

contract('CAmpl:borrowRepay', function (accounts) {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
  });

  describe('O supplies 1m and A borrows 1m AMPL', function(){
    beforeEach(async function(){
      // O supplies 1m
      await ampl.approve(cAmpl.address, AMPLS_SUPPLIED);
      await cAmpl.mint(AMPLS_SUPPLIED, {from:owner});
      mintSupply = await cAmpl.balanceOf(owner);

      // A starts off with 1.2m AMPLS, borrows another 1m
      await ampl.transfer(anotherAccount, toAmplDecimals(1200000));
      expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(1200000));
      await cAmpl.borrow(toAmplDecimals(1000000), {from: anotherAccount});
      expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(2200000));
    });

    describe('After 1h rebase increases supply by 100%, A repays borrow', function(){
      beforeEach(async function(){
        await invokeRebase(ampl, 100); // +100% supply
        await chain.waitForNBlocks(240);
        await cAmpl.accrueInterest();
      });

      it('A keeps the supply gains from rebase, O gets principal + interest', async function(){
        // A's balance after rebase 4.4m
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(4400000));
        // Interest accrued is around 19.56 AMPL
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN("1000019568112633");

        // A Repays everything
        await ampl.approve(cAmpl.address, toAmplDecimals(1000020), {from: anotherAccount});
        await cAmpl.repayBorrow(-1, {from: anotherAccount});

        // A's balance after repaying 3,399,980.27 AMPL
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN(0);
        expect(await cAmpl.totalBorrows.call()).to.eq.BN(0);
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN("3399980270164264");

        // O's final balance 1,000,019.72 AMPL
        const b = await ampl.balanceOf(owner);
        await cAmpl.redeem(mintSupply);
        const b_ = await ampl.balanceOf(owner);
        expect(b_.sub(b)).to.eq.BN("1000019729835736");
      });
    });

    describe('After 1h rebase decreases supply by 50%, A repays borrow', function(){
      beforeEach(async function(){
        await invokeRebase(ampl, -50); // -50% supply
        await chain.waitForNBlocks(240);
        await cAmpl.accrueInterest();
      });

      it('A keeps the pays for supply losses from rebase, O gets principal + interest', async function(){
        // A's balance after rebase 1.1m
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(toAmplDecimals(1100000));
        // Interest accrued is around 19.56 AMPL
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN("1000019568112633");

        // A Repays everything
        await ampl.approve(cAmpl.address, toAmplDecimals(1000020), {from: anotherAccount});
        await cAmpl.repayBorrow(-1, {from: anotherAccount}); // Repay everything

        // A's balance after repaying 99,980.27 AMPL
        expect(await cAmpl.borrowBalanceStored.call(anotherAccount)).to.eq.BN(0);
        expect(await ampl.balanceOf.call(anotherAccount)).to.eq.BN(99980270164264);

        // O's final balance 1,000,019.72 AMPL
        const b = await ampl.balanceOf(owner);
        await cAmpl.redeem(mintSupply);
        const b_ = await ampl.balanceOf(owner);
        expect(b_.sub(b)).to.eq.BN("1000019729835736");
      });
    });
  });
});
