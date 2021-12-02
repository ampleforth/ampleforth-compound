import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, Signer, BigNumber } from 'ethers'
import { setupCAmpl, toAmplFixedPt, rebase, waitForNBlocks } from './helpers'

const AMPLS_SUPPLIED = toAmplFixedPt('1000001') // 1m
const MAX_REPAY = ethers.constants.MaxUint256

let ampl: Contract,
  cAmpl: Contract,
  admin: Signer,
  anotherAccount: Signer,
  adminAddress: string,
  anotherAccountAddress: string,
  mintSupply: BigNumber
async function setupContractAndAccounts() {
  ;({ ampl, cAmpl, admin } = await setupCAmpl())
  adminAddress = await admin.getAddress()

  const accounts = await ethers.getSigners()
  anotherAccount = accounts[8]
  anotherAccountAddress = await anotherAccount.getAddress()
}

describe('CAmpl:borrowRepay', function () {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts()
  })

  describe('O supplies 1m and A borrows 1m AMPL', function () {
    beforeEach(async function () {
      // O supplies 1m
      await ampl.connect(admin).approve(cAmpl.address, AMPLS_SUPPLIED)
      await cAmpl.connect(admin).mint(AMPLS_SUPPLIED)
      mintSupply = await cAmpl.balanceOf(adminAddress)

      // small amount borrowed to handling rounding down after rebase
      await cAmpl.connect(admin).borrow(toAmplFixedPt('1'))

      // A starts off with 1.2m AMPLS, borrows another 1m
      await ampl.transfer(anotherAccountAddress, toAmplFixedPt('1200000'))
      expect(await ampl.balanceOf(anotherAccountAddress)).to.eq(
        toAmplFixedPt('1200000'),
      )
      await cAmpl.connect(anotherAccount).borrow(toAmplFixedPt('1000000'))
      expect(await ampl.balanceOf(anotherAccountAddress)).to.eq(
        toAmplFixedPt('2200000'),
      )
    })

    describe('After 1h rebase increases supply by 100%, A repays borrow', function () {
      beforeEach(async function () {
        await rebase(ampl, 100) // +100% supply
        await waitForNBlocks(240)
        await cAmpl.accrueInterest()
      })

      it('A keeps the supply gains from rebase, O gets principal + interest', async function () {
        // A's balance after rebase 4.4m
        expect(await ampl.balanceOf(anotherAccountAddress)).to.eq(
          toAmplFixedPt('4400000'),
        )
        // Interest accrued is around 19.56 AMPL
        expect(
          await cAmpl.callStatic.borrowBalanceStored(anotherAccountAddress),
        ).to.eq('1000002302130897')

        // A Repays everything
        await ampl
          .connect(anotherAccount)
          .approve(cAmpl.address, toAmplFixedPt('1000020'))
        await cAmpl.connect(anotherAccount).repayBorrow(MAX_REPAY)

        // A's balance after repaying 3,399,980.27 AMPL
        expect(
          await cAmpl.callStatic.borrowBalanceStored(anotherAccountAddress),
        ).to.eq(0)
        expect(await ampl.balanceOf(anotherAccountAddress)).to.eq(
          '3399997678843184',
        )

        await ampl.connect(admin).approve(cAmpl.address, toAmplFixedPt('2'))
        await cAmpl.connect(admin).repayBorrow(MAX_REPAY)
        expect(await cAmpl.callStatic.totalBorrows()).to.eq('1')

        // O's final balance 1,000,019.72 AMPL
        const b = await ampl.balanceOf(adminAddress)
        await cAmpl.redeem(mintSupply)
        const b_ = await ampl.balanceOf(adminAddress)
        expect(b_.sub(b)).to.eq('1000003321002321')
      })
    })

    describe('After 1h rebase decreases supply by 50%, A repays borrow', function () {
      beforeEach(async function () {
        await rebase(ampl, -50) // -50% supply
        await waitForNBlocks(240)
        await cAmpl.accrueInterest()
      })

      it('A keeps the pays for supply losses from rebase, O gets principal + interest', async function () {
        // A's balance after rebase 1.1m
        expect(await ampl.balanceOf(anotherAccountAddress)).to.eq(
          toAmplFixedPt('1100000'),
        )
        // Interest accrued is around 19.56 AMPL
        expect(
          await cAmpl.callStatic.borrowBalanceStored(anotherAccountAddress),
        ).to.eq('1000002302130897')

        // A Repays everything
        await ampl
          .connect(anotherAccount)
          .approve(cAmpl.address, toAmplFixedPt('1000020'))
        await cAmpl.connect(anotherAccount).repayBorrow(MAX_REPAY) // Repay everything

        // A's balance after repaying 99,980.27 AMPL
        expect(
          await cAmpl.callStatic.borrowBalanceStored(anotherAccountAddress),
        ).to.eq(0)
        expect(await ampl.balanceOf(anotherAccountAddress)).to.eq(
          '99997678843184',
        )

        await ampl.connect(admin).approve(cAmpl.address, toAmplFixedPt('2'))
        await cAmpl.connect(admin).repayBorrow(MAX_REPAY)
        expect(await cAmpl.callStatic.totalBorrows()).to.eq('1')

        // O's final balance 1,000,019.72 AMPL
        const b = await ampl.balanceOf(adminAddress)
        await cAmpl.redeem(mintSupply)
        const b_ = await ampl.balanceOf(adminAddress)
        expect(b_.sub(b)).to.eq('1000003321002321')
      })
    })
  })
})
