import '@nomiclabs/hardhat-waffle';
import "@nomiclabs/hardhat-etherscan";
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-contract-sizer';

import * as fs from 'fs';
import * as dotenv from 'dotenv'

dotenv.config()

const mnemonic = fs.readFileSync('.secret').toString().trim()

const infuraKey = process.env.INFURA_KEY
const etherscanKey = process.env.ETHERSCAN_KEY

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

export default {
  networks: {
    hardhat: {},
    ropsten: {
      url: `https://ropsten.infura.io/v3/${infuraKey}`,
      accounts: {
        mnemonic: mnemonic,
      },
    },
  },
  solidity: '0.7.3',
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  contractSizer: {
    alphaSort: true,
  },
  etherscan: {
    apiKey: etherscanKey
  }
};
