import "@nomiclabs/hardhat-waffle";

import "@typechain/hardhat";
import "solidity-coverage";
import "hardhat-contract-sizer";


// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

export default {
  solidity: "0.7.3",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  contractSizer: {
    alphaSort: true,
  }
};