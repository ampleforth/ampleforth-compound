const AmpleforthErc20 = artifacts.require('UFragments.sol');
const CAmpl = artifacts.require('CAmpl.sol');
const CAmplInterestRateModel = artifacts.require('CAmplInterestRateModel.sol');
const FakeCEtherInterestRateModel = artifacts.require('FakeCEtherInterestRateModel.sol');
const FakeComptroller = artifacts.require('FakeComptroller.sol');
const FakeCEther = artifacts.require('FakeCEther.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);
var BN = require('bn.js');
const chai = require('chai');
chai.use(require('bn-chai')(BN));
expect = chai.expect;

const AMPL_DECIMALS = 9;
function toAmplDecimals(x){
  return (new BN(x)).mul(new BN(10 ** AMPL_DECIMALS));
}

const INITIAL_AMPL_SUPPLY = toAmplDecimals(50000000);
const SUPPLY_DELTA_10 = INITIAL_AMPL_SUPPLY.div(new BN(10)); // 10%

const INITIAL_EXCHANGE_RATE = new BN(1);
const MINT_cAMPL_SUPPLY = toAmplDecimals(20000000).mul(INITIAL_EXCHANGE_RATE);

let ampl, cAmpl, owner, anotherAccount, recipient, r;
async function setupContractAndAccounts (accounts) {
  owner = accounts[0];
  anotherAccount = accounts[8];
  recipient = accounts[9];

  ampl = await AmpleforthErc20.new();
  await ampl.initialize(owner);
  await ampl.setMonetaryPolicy(owner);

  const irmCAmpl = await CAmplInterestRateModel.new();
  const irmCEther = await FakeCEtherInterestRateModel.new();
  const comptroller = await FakeComptroller.new();

  cAmpl = await CAmpl.new(ampl.address, comptroller.address, irmCAmpl.address);
  const cEther = await FakeCEther.new(comptroller.address, irmCEther.address);

  await comptroller._supportMarket(cAmpl.address);
  await comptroller._supportMarket(cEther.address);
}

contract('CAmpl', function (accounts) {
  beforeEach('setup CAmpl contract', async function () {
    await setupContractAndAccounts(accounts);
    await ampl.approve(cAmpl.address, MINT_cAMPL_SUPPLY);
    await cAmpl.mint(MINT_cAMPL_SUPPLY, {from:owner});
  });

  describe('when rebase increases AMPL supply', function () {
    beforeEach(async function(){
      await ampl.rebase(1, SUPPLY_DELTA_10); // +10% supply
    });
    it('should not update the totalSupply', async function() {
      expect(await cAmpl.totalSupply.call()).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should not update the cAmpl balance', async function () {
      expect(await cAmpl.balanceOf.call(owner)).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should update the underlying ampl balance', async function () {
      expect(await cAmpl.balanceOfUnderlying.call(owner)).to.eq.BN(toAmplDecimals(22000000));
      expect(await ampl.balanceOf.call(cAmpl.address)).to.eq.BN(toAmplDecimals(22000000));
    });
  });

  describe('when rebase decreases AMPL supply', function () {
    beforeEach(async function(){
      await ampl.rebase(1, -SUPPLY_DELTA_10); // -10% supply
    });
    it('should not update the totalSupply', async function() {
      expect(await cAmpl.totalSupply.call()).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should not update the cAmpl balance', async function () {
      expect(await cAmpl.balanceOf.call(owner)).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should update the underlying ampl balance', async function () {
      expect(await cAmpl.balanceOfUnderlying.call(owner)).to.eq.BN(toAmplDecimals(18000000));
      expect(await ampl.balanceOf.call(cAmpl.address)).to.eq.BN(toAmplDecimals(18000000));
    });
  });

  describe('when rebase does not change AMPL supply', function () {
    beforeEach(async function(){
      await ampl.rebase(1, 0);
    });
    it('should not update the totalSupply', async function() {
      expect(await cAmpl.totalSupply.call()).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should not update the cAmpl balance', async function () {
      expect(await cAmpl.balanceOf.call(owner)).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
    it('should update the underlying ampl balance', async function () {
      expect(await cAmpl.balanceOfUnderlying.call(owner)).to.eq.BN(MINT_cAMPL_SUPPLY);
      expect(await ampl.balanceOf.call(cAmpl.address)).to.eq.BN(MINT_cAMPL_SUPPLY);
    });
  });
});
