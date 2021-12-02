import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, Signer } from 'ethers'
import { setupCAmpl, toAmplFixedPt, toCAmplFixedPt, rebase } from './helpers'

const AMPLS_SUPPLIED = toAmplFixedPt('2000000') // 2m
const AMPLS_BORROWED = toAmplFixedPt('1500000') // 1.5m
const MINT_cAMPL_SUPPLY = toCAmplFixedPt('2000000')

let ampl: Contract,
  cAmpl: Contract,
  admin: Signer,
  anotherAccount: Signer,
  adminAddress: string
async function setupContractAndAccounts() {
  ;({ ampl, cAmpl, admin } = await setupCAmpl())
  adminAddress = await admin.getAddress()

  const accounts = await ethers.getSigners()
  anotherAccount = accounts[8]
}

describe('CAmpl', function () {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts()
    await ampl.connect(admin).approve(cAmpl.address, AMPLS_SUPPLIED)
    await cAmpl.connect(admin).mint(AMPLS_SUPPLIED)
  })

  describe('when utilization ratio is 0', function () {
    // supplier gets all of the rebase rewards or losses
    describe('when rebase increases AMPL supply', function () {
      beforeEach(async function () {
        await rebase(ampl, 10) // +10% supply
      })
      it('should NOT update the totalSupply', async function () {
        expect(await cAmpl.totalSupply()).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should NOT update the cAmpl balance', async function () {
        expect(await cAmpl.balanceOf(adminAddress)).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should update the underlying ampl balance', async function () {
        expect(await cAmpl.callStatic.balanceOfUnderlying(adminAddress)).to.eq(
          toAmplFixedPt('2200000'),
        )
        expect(await ampl.balanceOf(cAmpl.address)).to.eq(
          toAmplFixedPt('2200000'),
        )
      })
    })

    describe('when rebase decreases AMPL supply', function () {
      beforeEach(async function () {
        await rebase(ampl, -10) // -10% supply
      })
      it('should NOT update the totalSupply', async function () {
        expect(await cAmpl.totalSupply()).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should NOT update the cAmpl balance', async function () {
        expect(await cAmpl.balanceOf(adminAddress)).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should update the underlying ampl balance', async function () {
        expect(await cAmpl.callStatic.balanceOfUnderlying(adminAddress)).to.eq(
          toAmplFixedPt('1800000'),
        )
        expect(await ampl.balanceOf(cAmpl.address)).to.eq(
          toAmplFixedPt('1800000'),
        )
      })
    })

    describe('when rebase does NOT change AMPL supply', function () {
      beforeEach(async function () {
        await rebase(ampl, 0)
      })
      it('should NOT update the totalSupply', async function () {
        expect(await cAmpl.totalSupply()).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should NOT update the cAmpl balance', async function () {
        expect(await cAmpl.balanceOf(adminAddress)).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should update the underlying ampl balance', async function () {
        expect(await cAmpl.callStatic.balanceOfUnderlying(adminAddress)).to.eq(
          AMPLS_SUPPLIED,
        )
        expect(await ampl.balanceOf(cAmpl.address)).to.eq(AMPLS_SUPPLIED)
      })
    })
  })

  describe('when utilization ratio > 0', function () {
    // supplier gets part (based on the un-utilized cash) of the rebase rewards or losses
    beforeEach(async function () {
      // 75% of cash is borrowed
      await cAmpl.connect(anotherAccount).borrow(AMPLS_BORROWED)
    })

    describe('when rebase increases AMPL supply', function () {
      beforeEach(async function () {
        await rebase(ampl, 10) // +10% supply
      })
      it('should NOT update the totalSupply', async function () {
        expect(await cAmpl.totalSupply()).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should NOT update the cAmpl balance', async function () {
        expect(await cAmpl.balanceOf(adminAddress)).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should update the underlying ampl balance', async function () {
        // NOTE: Ideally, this needs to be exactly 2.05m AMPL but the difference arises due to
        // precision loss on conversion between cAmpl balances to Ampl balances
        // current value is 2,050,000.09 AMPL
        expect(await cAmpl.callStatic.balanceOfUnderlying(adminAddress)).to.eq(
          '2050000014000000',
        )
        expect(await ampl.balanceOf(cAmpl.address)).to.eq(
          toAmplFixedPt('550000'),
        )
      })
    })

    describe('when rebase decreases AMPL supply', function () {
      beforeEach(async function () {
        await rebase(ampl, -10) // -10% supply
      })
      it('should NOT update the totalSupply', async function () {
        expect(await cAmpl.totalSupply()).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should NOT update the cAmpl balance', async function () {
        expect(await cAmpl.balanceOf(adminAddress)).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should update the underlying ampl balance', async function () {
        // NOTE: Ideally, this needs to be exactly 1.95m AMPL
        // current value is 1,950,000.10 AMPL
        expect(await cAmpl.callStatic.balanceOfUnderlying(adminAddress)).to.eq(
          '1950000014000000',
        )
        expect(await ampl.balanceOf(cAmpl.address)).to.eq(
          toAmplFixedPt('450000'),
        )
      })
    })

    describe('when rebase does NOT change AMPL supply', function () {
      beforeEach(async function () {
        await rebase(ampl, 0)
      })
      it('should NOT update the totalSupply', async function () {
        expect(await cAmpl.totalSupply()).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should NOT update the cAmpl balance', async function () {
        expect(await cAmpl.balanceOf(adminAddress)).to.eq(MINT_cAMPL_SUPPLY)
      })
      it('should update the underlying ampl balance', async function () {
        expect(await cAmpl.callStatic.balanceOfUnderlying(adminAddress)).to.eq(
          '2000000014000000',
        )
        expect(await ampl.balanceOf(cAmpl.address)).to.eq(
          toAmplFixedPt('500000'),
        )
      })
    })
  })
})
