import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, Signer } from 'ethers'
import { setupCAmpl, toAmplFixedPt, toCAmplFixedPt, rebase } from './helpers'

const AMPLS_SUPPLIED = toAmplFixedPt('2000000') // 2m
const MINT_cAMPL_SUPPLY = toCAmplFixedPt('2000000')

let ampl: Contract,
  cAmpl: Contract,
  admin: Signer,
  anotherAccount: Signer,
  adminAddress: string,
  anotherAccountAddress: string
async function setupContractAndAccounts() {
  ;({ ampl, cAmpl, admin } = await setupCAmpl())
  adminAddress = await admin.getAddress()

  const accounts = await ethers.getSigners()
  anotherAccount = accounts[8]
  anotherAccountAddress = await anotherAccount.getAddress()
}

describe('CAmpl:mint', function () {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts()
    await ampl.connect(admin).approve(cAmpl.address, AMPLS_SUPPLIED)
    await ampl
      .connect(admin)
      .transfer(anotherAccountAddress, AMPLS_SUPPLIED.mul('2'))
    await cAmpl.connect(admin).mint(AMPLS_SUPPLIED)
  })

  // exchangeRate = (totalCash + totalBorrows - totalReserves) / totalSupply
  // NOTE: if Rebases increases supply, then total cash increases thus the exchange rate
  // mintTokens = mintAmount / exchangeRate
  // If exchangeRate increase by 10%, for the same mintAmount mintTokens reduces by 9.09..%
  // If exchangeRate decreases by 10%, for the same mintAmount mintTokens increases by 11.11..%
  describe('when rebase increases AMPL supply by 10%', function () {
    it('should mint fewer cAmpls after rebase', async function () {
      await rebase(ampl, 10)
      await ampl.connect(anotherAccount).approve(cAmpl.address, AMPLS_SUPPLIED)
      await cAmpl.connect(anotherAccount).mint(AMPLS_SUPPLIED)
      expect(await cAmpl.callStatic.balanceOf(adminAddress)).to.eq(
        MINT_cAMPL_SUPPLY,
      )
      expect(await cAmpl.callStatic.balanceOf(anotherAccountAddress)).to.eq(
        '1818181818181818181818181',
      )
    })
  })

  describe('when rebase decreases AMPL supply by 10%', function () {
    it('should mint more cAmpls after rebase', async function () {
      await rebase(ampl, -10)
      await ampl.connect(anotherAccount).approve(cAmpl.address, AMPLS_SUPPLIED)
      await cAmpl.connect(anotherAccount).mint(AMPLS_SUPPLIED)
      expect(await cAmpl.callStatic.balanceOf(adminAddress)).to.eq(
        MINT_cAMPL_SUPPLY,
      )
      expect(await cAmpl.callStatic.balanceOf(anotherAccountAddress)).to.eq(
        '2222222222222222222222222',
      )
    })
  })

  describe('when rebase does not change AMPL supply', function () {
    it('should mint the same number of cAmpls after rebase', async function () {
      await rebase(ampl, 0)
      await ampl.connect(anotherAccount).approve(cAmpl.address, AMPLS_SUPPLIED)
      await cAmpl.connect(anotherAccount).mint(AMPLS_SUPPLIED)
      expect(await cAmpl.callStatic.balanceOf(adminAddress)).to.eq(
        MINT_cAMPL_SUPPLY,
      )
      expect(await cAmpl.callStatic.balanceOf(anotherAccountAddress)).to.eq(
        MINT_cAMPL_SUPPLY,
      )
    })
  })
})
