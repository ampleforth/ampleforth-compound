import { ethers, upgrades } from 'hardhat'
import { Contract, BigNumber } from 'ethers'

const AMPL_DECIMALS = 9

interface CAmplDeployment {
  ampl: Contract
  cAmpl: Contract
  cEther: Contract
  comptroller: Contract
  irm: Contract
  admin: Signer
}

export const setupCAmpl = async (): CAmplDeployment => {
  const accounts = await ethers.getSigners()
  const admin = accounts[0]
  const adminAddress = await admin.getAddress()

  const ampl = await upgrades.deployProxy(
    await ethers.getContractFactory('UFragments'),
    [adminAddress],
    {
      initializer: 'initialize(address)',
    },
  )
  await ampl.setMonetaryPolicy(adminAddress)

  const comptroller = await (await ethers.getContractFactory('MockComptroller'))
    .connect(admin)
    .deploy()

  const irm = await (await ethers.getContractFactory('MockIRM'))
    .connect(admin)
    .deploy()

  const cAmpl = await (await ethers.getContractFactory('CAmpl'))
    .connect(admin)
    .deploy(ampl.address, comptroller.address, irm.address)

  const cEther = await (await ethers.getContractFactory('MockCEther'))
    .connect(admin)
    .deploy(comptroller.address, irm.address, adminAddress)

  await comptroller.connect(admin)._supportMarket(cAmpl.address)
  await comptroller.connect(admin)._supportMarket(cEther.address)

  return { ampl, cAmpl, cEther, admin, comptroller, irm }
}

export const toAmplFixedPt = (ample: string): BigNumber =>
  ethers.utils.parseUnits(ample, AMPL_DECIMALS)

export const toCAmplFixedPt = (ample: string): BigNumber =>
  ethers.utils.parseUnits(ample, 18)

export const rebase = async (ampl: Contract, perc: number): void => {
  const s = await ampl.totalSupply()
  await ampl.rebase(1, s.mul(perc).div('100'))
}

export const waitForNBlocks = async (blocks: number): void => {
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send('evm_mine', [])
  }
}
