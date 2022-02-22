import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import "@openzeppelin/hardhat-upgrades";

import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";
import "hardhat-deploy";
import "hardhat-docgen";
import "solidity-coverage";
import "@symblox/hardhat-abi-gen";
import "@huskylab/hardhat-signer";

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000,
    },
    localhost: {
      url: 'http://localhost:8545',
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY],
    },
    testnet: {
      url: 'https://data-seed-prebsc-1-s3.binance.org:8545',
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY2], 
    },
    mainnet: {
      url: 'https://bsc-dataseed.binance.org/',
      hdSigner: 'trezor',
      address: '0x3583Fa30Dd165B339f34B965CA25B58470C5e343',
    },
    kovan: {
      url: 'https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      chainId: 42,
      accounts: [process.env.KOVAN_PRIVATE_KEY],
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  solidity: {
    version: '0.6.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      evmVersion: "istanbul",
      outputSelection: {
        "*": {
          "": [
            "ast"
          ],
          "*": [
            "evm.bytecode.object",
            "evm.deployedBytecode.object",
            "evm.bytecode.sourceMap",
            "evm.deployedBytecode.sourceMap",
            "metadata"
          ]
        }
      },
    },
  },
  paths: {
    sources: './contracts/6',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  typechain: {
    outDir: './typechain',
    target: process.env.TYPECHAIN_TARGET || 'ethers-v5',
  },
  abiExporter: {
    path: './abi',
    clear: true,
    flat: true,
    spacing: 2
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: true,
    only: ['./protocol/', './token/']
  }
};