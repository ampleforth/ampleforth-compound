import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, Signer, BigNumber, BigNumberish } from 'ethers'
import { setupCAmpl, toAmplFixedPt, rebase, waitForNBlocks } from './helpers'

const AMPLS_SUPPLIED = toAmplFixedPt('2000000') // 2m
const AMPLS_BORROWED = toAmplFixedPt('1000000') // 1m
const IE_RATE = toAmplFixedPt('1')
const MAX_REPAY = ethers.constants.MaxUint256

let ampl: Contract,
  cAmpl: Contract,
  admin: Signer,
  anotherAccount: Signer,
  anotherAccountAddress: string
async function setupContractAndAccounts() {
  ;({ ampl, cAmpl, admin } = await setupCAmpl())
  adminAddress = await admin.getAddress()

  const accounts = await ethers.getSigners()
  anotherAccount = accounts[8]
  anotherAccountAddress = await anotherAccount.getAddress()
}

function perc(n: BigNumberish, p: number) {
  return BigNumber.from(n)
    .mul(BigNumber.from(100 + p))
    .div(BigNumber.from(100))
}

describe('CAmpl:interestRate', function () {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts()
    await ampl.connect(admin).approve(cAmpl.address, AMPLS_SUPPLIED)
    await cAmpl.connect(admin).mint(AMPLS_SUPPLIED)
  })

  // exchangeRate = (totalCash + totalBorrows - totalReserves) / totalSupply
  // UtilizationRate = borrows / (borrows + totalCash)
  // borrowRate = 0.05(baseRate) + UtilizationRate * 0.12(multiplier)
  // supplyRate = borrowRate × (1-reserveFactor) × (totalBorrows ÷ (totalCash + totalBorrows - totalReserves))
  describe('when totalBorrows=0, reserve=0', function () {
    it('should set initial values', async function () {
      expect(await cAmpl.getCash.call()).to.eq(AMPLS_SUPPLIED)
      expect(await cAmpl.totalBorrows.call()).to.eq(0)
      expect(await cAmpl.totalReserves.call()).to.eq(0)
      // 0.00000009512937595 AMPL per block
      // 0.00000009512937595 * 2102400 (blocks per year) = 0.05 AMPL per year (baseRate)
      expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      expect(await cAmpl.supplyRatePerBlock.call()).to.eq(0)
      expect(await cAmpl.exchangeRateStored.call()).to.eq(IE_RATE)
    })

    describe('when rebase increases AMPL supply by 10%', function () {
      beforeEach(async function () {
        await rebase(ampl, 10) // +10% supply
      })
      it('should increase the total cash by 10%', async function () {
        expect(await cAmpl.getCash.call()).to.eq(perc(AMPLS_SUPPLIED, 10))
      })
      it('should NOT change the totalBorrows', async function () {
        expect(await cAmpl.totalBorrows.call()).to.eq(0)
      })
      it('should NOT change the total reserves', async function () {
        expect(await cAmpl.totalReserves.call()).to.eq(0)
      })
      it('should NOT change the borrow rate', async function () {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      })
      it('should NOT change the supply rate', async function () {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq(0)
      })
      it('should increase the exchange rate by 10%', async function () {
        expect(await cAmpl.exchangeRateStored.call()).to.eq(perc(IE_RATE, 10))
      })
    })

    describe('when rebase decreases AMPL supply by 10%', function () {
      beforeEach(async function () {
        await rebase(ampl, -10) // -10% supply
      })
      it('should decrease the total cash by 10%', async function () {
        expect(await cAmpl.getCash.call()).to.eq(perc(AMPLS_SUPPLIED, -10))
      })
      it('should NOT change the totalBorrows', async function () {
        expect(await cAmpl.totalBorrows.call()).to.eq(0)
      })
      it('should NOT change the total reserves', async function () {
        expect(await cAmpl.totalReserves.call()).to.eq(0)
      })
      it('should NOT change the borrow rate', async function () {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      })
      it('should NOT change the supply rate', async function () {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq(0)
      })
      it('should decrease the exchange rate', async function () {
        expect(await cAmpl.exchangeRateStored.call()).to.eq(perc(IE_RATE, -10))
      })
    })

    describe('when rebase does NOT change AMPL supply', function () {
      beforeEach(async function () {
        await rebase(ampl, 0)
      })
      it('should NOT update the total cash', async function () {
        expect(await cAmpl.getCash.call()).to.eq(AMPLS_SUPPLIED)
      })
      it('should NOT change the totalBorrows', async function () {
        expect(await cAmpl.totalBorrows.call()).to.eq(0)
      })
      it('should NOT change the total reserves', async function () {
        expect(await cAmpl.totalReserves.call()).to.eq(0)
      })
      it('should NOT change the borrow rate', async function () {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      })
      it('should NOT change the supply rate', async function () {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq(0)
      })
      it('should NOT update the exchange rate', async function () {
        expect(await cAmpl.exchangeRateStored.call()).to.eq(IE_RATE)
      })
    })
  })

  describe('when totalBorrows=50%, reserve=0', function () {
    let CASH_REMAINING: BigNumber
    beforeEach(async function () {
      await cAmpl.connect(anotherAccount).borrow(AMPLS_BORROWED) // 50% of cash is borrowed
      CASH_REMAINING = AMPLS_SUPPLIED.sub(AMPLS_BORROWED) // 1m
    })

    it('should set initial values', async function () {
      expect(await cAmpl.exchangeRateStored.call()).to.eq(IE_RATE)
      expect(await cAmpl.getCash.call()).to.eq(CASH_REMAINING)
      expect(await cAmpl.totalBorrows.call()).to.eq(AMPLS_BORROWED)
      expect(await cAmpl.totalReserves.call()).to.eq(0)
      // UtilizationRate = 0.5 => borrowRate = 0.11
      // borrowRatePerBlock = 0.00000009512937595 (0.00000009512937595 * 2102400 = 0.11)
      expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      // supplyRate = borrowRate * 0.5 => 0.00000004756468797
      expect(await cAmpl.supplyRatePerBlock.call()).to.eq('4756468797')
    })

    describe('when rebase increases AMPL supply by 10%', function () {
      beforeEach(async function () {
        await rebase(ampl, 10) // +10% supply
      })
      it('should increase the total cash by 10%', async function () {
        expect(await cAmpl.getCash.call()).to.eq(perc(CASH_REMAINING, 10))
      })
      it('should NOT change the totalBorrows', async function () {
        expect(await cAmpl.totalBorrows.call()).to.eq(AMPLS_BORROWED)
      })
      it('should NOT change the total reserves', async function () {
        expect(await cAmpl.totalReserves.call()).to.eq(0)
      })
      it('should decrease the borrow rate', async function () {
        // UtilizationRate = 0.476, borrowRate = 0.107
        // borrowRatePerBlock = 0.00000009512937595 (~0.107/2102400)
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      })
      it('should decrease the supply rate', async function () {
        // supplyRatePerBlock = borrowRatePerBlock * 0.476.. = 0.00000004529970283
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq('4529970283')
      })
      it('should increase the exchange rate by 5%', async function () {
        // Cash goes up by 10%, borrow remains the same
        expect(await cAmpl.exchangeRateStored.call()).to.eq(perc(IE_RATE, 5))
      })
    })

    describe('when rebase decreases AMPL supply by 10%', function () {
      beforeEach(async function () {
        await rebase(ampl, -10) // -10% supply
      })
      it('should decrease the total cash by 10%', async function () {
        expect(await cAmpl.getCash.call()).to.eq(perc(CASH_REMAINING, -10))
      })
      it('should NOT change the totalBorrows', async function () {
        expect(await cAmpl.totalBorrows.call()).to.eq(AMPLS_BORROWED)
      })
      it('should NOT change the total reserves', async function () {
        expect(await cAmpl.totalReserves.call()).to.eq(0)
      })
      it('should increase the borrow rate', async function () {
        // UtilizationRate = 0.526, borrowRate = 0.11312
        // borrowRatePerBlock = 0.00000009512937595 (~0.11312/2102400)
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      })
      it('should increase the supply rate', async function () {
        // supplyRatePerBlock = borrowRatePerBlock * 0.526.. = 0.00000005006809260
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq('5006809260')
      })
      it('should decrease the exchange rate by 5%', async function () {
        // Cash goes down by 10%, borrow remains the same
        expect(await cAmpl.exchangeRateStored.call()).to.eq(perc(IE_RATE, -5))
      })
    })

    describe('when rebase does NOT change AMPL supply', function () {
      beforeEach(async function () {
        await rebase(ampl, 0)
      })
      it('should NOT update the total cash', async function () {
        expect(await cAmpl.getCash.call()).to.eq(CASH_REMAINING)
      })
      it('should NOT change the totalBorrows', async function () {
        expect(await cAmpl.totalBorrows.call()).to.eq(AMPLS_BORROWED)
      })
      it('should NOT change the total reserves', async function () {
        expect(await cAmpl.totalReserves.call()).to.eq(0)
      })
      it('should NOT change the borrow rate', async function () {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      })
      it('should NOT change the supply rate', async function () {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq('4756468797')
      })
      it('should NOT update the exchange rate', async function () {
        expect(await cAmpl.exchangeRateStored.call()).to.eq(IE_RATE)
      })
    })
  })

  describe('when totalBorrows=50%, reserve>0', function () {
    beforeEach(async function () {
      // transferring some ampls to pay back interest
      await ampl.transfer(anotherAccountAddress, toAmplFixedPt('100'))

      await cAmpl._setReserveFactor('300000000000000000') // 30%
      await cAmpl.connect(anotherAccount).borrow(AMPLS_BORROWED) // 50% of cash is borrowed
      await waitForNBlocks(240) // wait 1 hr

      // Part of the repaid amount goes into the reserve
      await ampl.connect(anotherAccount).approve(cAmpl.address, AMPLS_SUPPLIED)
      await cAmpl.connect(anotherAccount).repayBorrow(MAX_REPAY)

      await cAmpl.connect(anotherAccount).borrow(AMPLS_BORROWED) // Borrow 50% again
      await waitForNBlocks(240) // wait 1 hr
      await cAmpl.accrueInterest()
    })

    it('should set initial values', async function () {
      expect(await cAmpl.exchangeRateStored.call()).to.eq('1000001608')
      expect(await cAmpl.getCash.call()).to.eq('1000002302130897')
      expect(await cAmpl.totalBorrows.call()).to.eq('1000002292617960')
      expect(await cAmpl.totalReserves.call()).to.eq('1378424657')
      expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      expect(await cAmpl.supplyRatePerBlock.call()).to.eq('3329530436')
    })

    describe('when rebase increases AMPL supply by 10%', function () {
      beforeEach(async function () {
        await rebase(ampl, 10) // +10% supply
      })
      it('should increase the total cash by 10%', async function () {
        expect(await cAmpl.getCash.call()).to.eq(perc('1000002302130897', 10))
      })
      it('should NOT change the totalBorrows', async function () {
        expect(await cAmpl.totalBorrows.call()).to.eq('1000002292617960')
      })
      it('should NOT change the total reserves', async function () {
        expect(await cAmpl.totalReserves.call()).to.eq('1378424657')
      })
      it('should decrease the borrow rate', async function () {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      })
      it('should decrease the supply rate', async function () {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq('3170981263')
      })
      it('should increase the exchange rate', async function () {
        expect(await cAmpl.exchangeRateStored.call()).to.eq('1050001723')
      })
    })

    describe('when rebase decreases AMPL supply by 10%', function () {
      beforeEach(async function () {
        await rebase(ampl, -10) // -10% supply
      })
      it('should decrease the total cash by 10%', async function () {
        expect(await cAmpl.getCash.call()).to.eq('900002071917807')
      })
      it('should NOT change the totalBorrows', async function () {
        expect(await cAmpl.totalBorrows.call()).to.eq('1000002292617960')
      })
      it('should NOT change the total reserves', async function () {
        expect(await cAmpl.totalReserves.call()).to.eq('1378424657')
      })
      it('should increase the borrow rate', async function () {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      })
      it('should increase the supply rate', async function () {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq('3504769008')
      })
      it('should decrease the exchange rate', async function () {
        expect(await cAmpl.exchangeRateStored.call()).to.eq('950001493')
      })
    })

    describe('when rebase does NOT change AMPL supply', function () {
      beforeEach(async function () {
        await rebase(ampl, 0)
      })
      it('should decrease the total cash by 10%', async function () {
        expect(await cAmpl.getCash.call()).to.eq('1000002302130897')
      })
      it('should NOT change the totalBorrows', async function () {
        expect(await cAmpl.totalBorrows.call()).to.eq('1000002292617960')
      })
      it('should NOT change the total reserves', async function () {
        expect(await cAmpl.totalReserves.call()).to.eq('1378424657')
      })
      it('should NOT change the borrow rate', async function () {
        expect(await cAmpl.borrowRatePerBlock.call()).to.eq('9512937595')
      })
      it('should NOT change the supply rate', async function () {
        expect(await cAmpl.supplyRatePerBlock.call()).to.eq('3329530436')
      })
      it('should NOT change the exchange rate', async function () {
        expect(await cAmpl.exchangeRateStored.call()).to.eq('1000001608')
      })
    })
  })
})
