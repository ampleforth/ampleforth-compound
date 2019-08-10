const BN = require('bn.js');
const chai = require('chai');
chai.use(require('bn-chai')(BN));
expect = chai.expect;

const _require = require('app-root-path').require;
const { setupCAmpl, toAmplDecimals, invokeRebase, INITIAL_EXCHANGE_RATE } = _require('/test/helper');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

const AMPLS_SUPPLIED = toAmplDecimals(2000000); // 2m
const AMPLS_BORROWED = toAmplDecimals(1000000); // 1m
const IE_RATE = INITIAL_EXCHANGE_RATE.mul(new BN("1000000000000000000"));

let ampl, cAmpl, owner, anotherAccount, initCash;
async function setupContractAndAccounts (accounts) {
  owner = accounts[0];
  anotherAccount = accounts[8];
  [ampl, cAmpl] = await setupCAmpl(accounts);
}

function perc(n, p){
  return new BN(n).mul(new BN(100+p)).div(new BN(100));
}

contract('CAmpl:interestRate', function (accounts) {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
    await ampl.approve(cAmpl.address, AMPLS_SUPPLIED);
    await cAmpl.mint(AMPLS_SUPPLIED, {from:owner});
  });

  // exchangeRate = (totalCash + totalBorrows - totalReserves) / totalSupply
  // UtilizationRate = borrows / (borrows + totalCash)
  // borrowRate = 0.05(baseRate) + UtilizationRate * 0.12(multiplier)
  // supplyRate = borrowRate × (1-reserveFactor) × (totalBorrows ÷ (totalCash + totalBorrows - totalReserves))
  describe('when totalBorrows=0, reserve=0', function () {
    it('should set initial values', async function(){
      expect(await cAmpl.getCash.call()).to.eq.BN(AMPLS_SUPPLIED);
      expect(await cAmpl.totalBorrows.call()).to.eq.BN(0);
      expect(await cAmpl.totalReserves.call()).to.eq.BN(0);
      // 0.000000023782343987 AMPL per block
      // 0.000000023782343987 * 2102400 (blocks per year) = 0.05 AMPL per year (baseRate)
      expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("23782343987");
      expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN(0);
      expect(await cAmpl.exchangeRateStored.call()).to.eq.BN(IE_RATE);
    });

    describe('when rebase increases AMPL supply by 10%', function () {
      beforeEach(async function(){
        await invokeRebase(ampl, 10); // +10% supply
      });
      it('should increase the total cash by 10%', async function() {
        expect(await cAmpl.getCash.call()).to.eq.BN(perc(AMPLS_SUPPLIED, 10));
      });
      it('should NOT change the totalBorrows', async function() {
        expect(await cAmpl.totalBorrows.call()).to.eq.BN(0);
      });
      it('should NOT change the total reserves', async function() {
        expect(await cAmpl.totalReserves.call()).to.eq.BN(0);
      });
      it('should NOT change the borrow rate', async function() {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("23782343987");
      });
      it('should NOT change the supply rate', async function() {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN(0);
      });
      it('should increase the exchange rate by 10%', async function() {
        expect(await cAmpl.exchangeRateStored.call()).to.eq.BN(perc(IE_RATE, 10));
      });
    });

    describe('when rebase decreases AMPL supply by 10%', function () {
      beforeEach(async function(){
        await invokeRebase(ampl, -10); // -10% supply
      });
      it('should decrease the total cash by 10%', async function() {
        expect(await cAmpl.getCash.call()).to.eq.BN(perc(AMPLS_SUPPLIED, -10));
      });
      it('should NOT change the totalBorrows', async function() {
        expect(await cAmpl.totalBorrows.call()).to.eq.BN(0);
      });
      it('should NOT change the total reserves', async function() {
        expect(await cAmpl.totalReserves.call()).to.eq.BN(0);
      });
      it('should NOT change the borrow rate', async function() {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("23782343987");
      });
      it('should NOT change the supply rate', async function() {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN(0);
      });
      it('should decrease the exchange rate', async function() {
        expect(await cAmpl.exchangeRateStored.call()).to.eq.BN(perc(IE_RATE, -10));
      });
    });

    describe('when rebase does NOT change AMPL supply', function () {
      beforeEach(async function(){
        await invokeRebase(ampl, 0);
      });
      it('should NOT update the total cash', async function() {
        expect(await cAmpl.getCash.call()).to.eq.BN(AMPLS_SUPPLIED);
      });
      it('should NOT change the totalBorrows', async function() {
        expect(await cAmpl.totalBorrows.call()).to.eq.BN(0);
      });
      it('should NOT change the total reserves', async function() {
        expect(await cAmpl.totalReserves.call()).to.eq.BN(0);
      });
      it('should NOT change the borrow rate', async function() {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("23782343987");
      });
      it('should NOT change the supply rate', async function() {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN(0);
      });
      it('should NOT update the exchange rate', async function() {
        expect(await cAmpl.exchangeRateStored.call()).to.eq.BN(IE_RATE);
      });
    });
  });

  describe('when totalBorrows=50%, reserve=0', function () {
    let CASH_REMAINING;
    beforeEach(async function(){
      await cAmpl.borrow(AMPLS_BORROWED, {from: anotherAccount}); // 50% of cash is borrowed
      CASH_REMAINING = AMPLS_SUPPLIED.sub(AMPLS_BORROWED); // 1m
    });

    it('should set initial values', async function(){
      expect(await cAmpl.exchangeRateStored.call()).to.eq.BN(IE_RATE);
      expect(await cAmpl.getCash.call()).to.eq.BN(CASH_REMAINING);
      expect(await cAmpl.totalBorrows.call()).to.eq.BN(AMPLS_BORROWED);
      expect(await cAmpl.totalReserves.call()).to.eq.BN(0);
      // UtilizationRate = 0.5 => borrowRate = 0.11
      // borrowRatePerBlock = 0.000000052321156773 (0.000000052321156773 * 2102400 = 0.11)
      expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("52321156773");
      // supplyRate = borrowRate * 0.5 => 0.000000026160578387
      expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN("26160578387");
    });

    describe('when rebase increases AMPL supply by 10%', function () {
      beforeEach(async function(){
        await invokeRebase(ampl, 10); // +10% supply
      });
      it('should increase the total cash by 10%', async function() {
        expect(await cAmpl.getCash.call()).to.eq.BN(perc(CASH_REMAINING, 10));
      });
      it('should NOT change the totalBorrows', async function() {
        expect(await cAmpl.totalBorrows.call()).to.eq.BN(AMPLS_BORROWED);
      });
      it('should NOT change the total reserves', async function() {
        expect(await cAmpl.totalReserves.call()).to.eq.BN(0);
      });
      it('should decrease the borrow rate', async function() {
        // UtilizationRate = 0.476, borrowRate = 0.107
        // borrowRatePerBlock = 0.000000050962165688 (~0.107/2102400)
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("50962165688");
      });
      it('should decrease the supply rate', async function() {
        // supplyRatePerBlock = borrowRatePerBlock * 0.476.. = 0.000000024267697947
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN("24267697947");
      });
      it('should increase the exchange rate by 5%', async function() {
        // Cash goes up by 10%, borrow remains the same
        expect(await cAmpl.exchangeRateStored.call()).to.eq.BN(perc(IE_RATE, 5));
      });
    });

    describe('when rebase decreases AMPL supply by 10%', function () {
      beforeEach(async function(){
        await invokeRebase(ampl, -10); // -10% supply
      });
      it('should decrease the total cash by 10%', async function() {
        expect(await cAmpl.getCash.call()).to.eq.BN(perc(CASH_REMAINING, -10));
      });
      it('should NOT change the totalBorrows', async function() {
        expect(await cAmpl.totalBorrows.call()).to.eq.BN(AMPLS_BORROWED);
      });
      it('should NOT change the total reserves', async function() {
        expect(await cAmpl.totalReserves.call()).to.eq.BN(0);
      });
      it('should increase the borrow rate', async function() {
        // UtilizationRate = 0.526, borrowRate = 0.11312
        // borrowRatePerBlock = 0.000000053823199551 (~0.11312/2102400)
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("53823199551");
      });
      it('should increase the supply rate', async function() {
        // supplyRatePerBlock = borrowRatePerBlock * 0.526.. = 0.000000028327999764
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN("28327999764");
      });
      it('should decrease the exchange rate by 5%', async function() {
        // Cash goes down by 10%, borrow remains the same
        expect(await cAmpl.exchangeRateStored.call()).to.eq.BN(perc(IE_RATE, -5));
      });
    });

    describe('when rebase does NOT change AMPL supply', function () {
      beforeEach(async function(){
        await invokeRebase(ampl, 0);
      });
      it('should NOT update the total cash', async function() {
        expect(await cAmpl.getCash.call()).to.eq.BN(CASH_REMAINING);
      });
      it('should NOT change the totalBorrows', async function() {
        expect(await cAmpl.totalBorrows.call()).to.eq.BN(AMPLS_BORROWED);
      });
      it('should NOT change the total reserves', async function() {
        expect(await cAmpl.totalReserves.call()).to.eq.BN(0);
      });
      it('should NOT change the borrow rate', async function() {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("52321156773");
      });
      it('should NOT change the supply rate', async function() {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN("26160578387");
      });
      it('should NOT update the exchange rate', async function() {
        expect(await cAmpl.exchangeRateStored.call()).to.eq.BN(IE_RATE);
      });
    });
  });

  describe('when totalBorrows=50%, reserve>0', function () {
    beforeEach(async function(){
      // transferring some ampls to pay back interest
      await ampl.transfer(anotherAccount, toAmplDecimals(100));

      await cAmpl._setReserveFactor("300000000000000000"); // 30%
      await cAmpl.borrow(AMPLS_BORROWED, {from: anotherAccount}); // 50% of cash is borrowed
      await chain.waitForNBlocks(240); // wait 1 hr

      // Part of the repaid amount goes into the reserve
      await ampl.approve(cAmpl.address, AMPLS_SUPPLIED, {from: anotherAccount});
      await cAmpl.repayBorrow(-1, {from: anotherAccount});

      await cAmpl.borrow(AMPLS_BORROWED, {from: anotherAccount}); // Borrow 50% again
      await chain.waitForNBlocks(240); // wait 1 hr
      await cAmpl.accrueInterest();
    });

    it('should set initial values', async function(){
      expect(await cAmpl.exchangeRateStored.call()).to.eq.BN("1000008844876313000");
      expect(await cAmpl.getCash.call()).to.eq.BN("1000012661719939");
      expect(await cAmpl.totalBorrows.call()).to.eq.BN("1000012609355239");
      expect(await cAmpl.totalReserves.call()).to.eq.BN("7581322552");
      expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("52321156026");
      expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN("18312473545");
    });

    describe('when rebase increases AMPL supply by 10%', function () {
      beforeEach(async function(){
        await invokeRebase(ampl, 10); // +10% supply
      });
      it('should increase the total cash by 10%', async function() {
        expect(await cAmpl.getCash.call()).to.eq.BN(perc("1000012661719939", 10));
      });
      it('should NOT change the totalBorrows', async function() {
        expect(await cAmpl.totalBorrows.call()).to.eq.BN("1000012609355239");
      });
      it('should NOT change the total reserves', async function() {
        expect(await cAmpl.totalReserves.call()).to.eq.BN("7581322552");
      });
      it('should decrease the borrow rate', async function() {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("50962164942");
      });
      it('should decrease the supply rate', async function() {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN("16987449174");
      });
      it('should increase the exchange rate', async function() {
        expect(await cAmpl.exchangeRateStored.call()).to.eq.BN("1050009477962309500");
      });
    });

    describe('when rebase decreases AMPL supply by 10%', function () {
      beforeEach(async function(){
        await invokeRebase(ampl, -10); // -10% supply
      });
      it('should decrease the total cash by 10%', async function() {
        expect(await cAmpl.getCash.call()).to.eq.BN("900011395547945");
      });
      it('should NOT change the totalBorrows', async function() {
        expect(await cAmpl.totalBorrows.call()).to.eq.BN("1000012609355239");
      });
      it('should NOT change the total reserves', async function() {
        expect(await cAmpl.totalReserves.call()).to.eq.BN("7581322552");
      });
      it('should increase the borrow rate', async function() {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("53823198806");
      });
      it('should increase the supply rate', async function() {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN("19829678191");
      });
      it('should decrease the exchange rate', async function() {
        expect(await cAmpl.exchangeRateStored.call()).to.eq.BN("950008211790316000");
      });
    });

    describe('when rebase does NOT change AMPL supply', function () {
      beforeEach(async function(){
        await invokeRebase(ampl, 0);
      });
      it('should decrease the total cash by 10%', async function() {
        expect(await cAmpl.getCash.call()).to.eq.BN("1000012661719939");
      });
      it('should NOT change the totalBorrows', async function() {
        expect(await cAmpl.totalBorrows.call()).to.eq.BN("1000012609355239");
      });
      it('should NOT change the total reserves', async function() {
        expect(await cAmpl.totalReserves.call()).to.eq.BN("7581322552");
      });
      it('should NOT change the borrow rate', async function() {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq.BN("52321156026");
      });
      it('should NOT change the supply rate', async function() {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq.BN("18312473545");
      });
      it('should NOT change the exchange rate', async function() {
        expect(await cAmpl.exchangeRateStored.call()).to.eq.BN("1000008844876313000");
      });
    });
  });
});
