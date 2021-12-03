import { expect } from 'chai'
import { Contract, Signer, BigNumber } from 'ethers'
import { setupCAmpl, toAmplFixedPt, rebase } from './helpers'

const AMPLS_SUPPLIED = toAmplFixedPt('2000000') // 2m

let ampl: Contract,
  cAmpl: Contract,
  admin: Signer,
  adminAddress: string,
  mintCamplSupply: BigNumber
async function setupContractAndAccounts() {
  ;({ ampl, cAmpl, admin } = await setupCAmpl())
  adminAddress = await admin.getAddress()
}

describe('CAmpl:redeem', function () {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts()
    await ampl.approve(cAmpl.address, AMPLS_SUPPLIED)
    await cAmpl.connect(admin).mint(AMPLS_SUPPLIED)
    mintCamplSupply = await cAmpl.balanceOf(adminAddress)
  })

  // exchangeRate = (totalCash + totalBorrows - totalReserves) / totalSupply
  // NOTE: if Rebases increases supply, then total cash increases thus the exchange rate
  // redeemAmount = redeemTokensIn x exchangeRateCurrent
  describe('when utilization ratio is 0', function () {
    describe('when rebase increases AMPL supply by 10%', function () {
      it('should redeem 10% more AMPLs', async function () {
        await rebase(ampl, 10)
        const b = await ampl.balanceOf(adminAddress)
        await cAmpl.redeem(mintCamplSupply)
        const b_ = await ampl.balanceOf(adminAddress)
        expect(b_.sub(b)).to.eq(toAmplFixedPt('2200000'))
      })
    })

    describe('when rebase decreases AMPL supply by 10%', function () {
      it('should redeem 10% fewer AMPLs', async function () {
        await rebase(ampl, -10)
        const b = await ampl.balanceOf(adminAddress)
        await cAmpl.redeem(mintCamplSupply)
        const b_ = await ampl.balanceOf(adminAddress)
        expect(b_.sub(b)).to.eq(toAmplFixedPt('1800000'))
      })
    })

    describe('when rebase does not change AMPL supply', function () {
      it('should redeem the minted number of AMPLs', async function () {
        await rebase(ampl, 0)
        const b = await ampl.balanceOf(adminAddress)
        await cAmpl.redeem(mintCamplSupply)
        const b_ = await ampl.balanceOf(adminAddress)
        expect(b_.sub(b)).to.eq(AMPLS_SUPPLIED)
      })
    })
  })
})
