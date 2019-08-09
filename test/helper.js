const AmpleforthErc20 = artifacts.require('UFragments.sol');
const CAmpl = artifacts.require('CAmpl.sol');
const CAmplInterestRateModel = artifacts.require('CAmplInterestRateModel.sol');
const FakeCEtherInterestRateModel = artifacts.require('FakeCEtherInterestRateModel.sol');
const FakeComptroller = artifacts.require('FakeComptroller.sol');
const FakeCEther = artifacts.require('FakeCEther.sol');
var BN = require('bn.js');

const AMPL_DECIMALS = 9;
const CAMPL_DECIMALS = 9;
const INITIAL_AMPL_SUPPLY = toAmplDecimals(50000000);
const INITIAL_EXCHANGE_RATE = new BN(1);

async function setupCAmpl (accounts) {
  const owner = accounts[0];

  const ampl = await AmpleforthErc20.new();
  await ampl.initialize(owner);
  await ampl.setMonetaryPolicy(owner);

  const irmCAmpl = await CAmplInterestRateModel.new();
  const irmCEther = await FakeCEtherInterestRateModel.new();
  const comptroller = await FakeComptroller.new();

  const cAmpl = await CAmpl.new(ampl.address, comptroller.address, irmCAmpl.address);
  const cEther = await FakeCEther.new(comptroller.address, irmCEther.address);

  await comptroller._supportMarket(cAmpl.address);
  await comptroller._supportMarket(cEther.address);

  return [ampl, cAmpl];
}

function toAmplDecimals(x){
  return (new BN(x)).mul(new BN(10 ** AMPL_DECIMALS));
}

function toCAmplDecimals(x){
  return (new BN(x)).mul(new BN(10 ** CAMPL_DECIMALS));
}

async function invokeRebase(ampl, perc){
  const s = await ampl.totalSupply.call();
  await ampl.rebase(1, s.mul(new BN(perc)).div(new BN(100)));
}

module.exports = { INITIAL_EXCHANGE_RATE, INITIAL_AMPL_SUPPLY,
  setupCAmpl, toAmplDecimals, toCAmplDecimals, invokeRebase };
