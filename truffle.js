const connectionConfig = require('frg-ethereum-runners/config/network_config.json');

module.exports = {
  networks: {
    ganacheUnitTest: connectionConfig.ganacheUnitTest,
    gethUnitTest: connectionConfig.gethUnitTest,
    testrpcCoverage: connectionConfig.testrpcCoverage
  },
  compilers: {
    solc: {
      version: '0.5.8',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },
  mocha: {
    enableTimeouts: false
  }
};
