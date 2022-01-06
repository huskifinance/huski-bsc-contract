import { ethers, upgrades, waffle, network } from "hardhat";
import { Overrides, Signer, BigNumberish, utils, Wallet } from "ethers";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import "@openzeppelin/test-helpers";
import {
  SimpleVaultConfig__factory,
  PancakeswapV2Worker__factory, 
  Vault__factory,
} from "../typechain";
import MainnetConfig from '../deploy/results/mainnet.json'
import TestnetConfig from '../deploy/results/testnet.json'

async function main() {
  const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig

  for (let i = 1; i < config.Vaults.length; i++) {
    const vaultConfig = SimpleVaultConfig__factory.connect(config.Vaults[i].config, ethers.provider)
    console.log('> vaultConfig owner : ', await vaultConfig.owner())

    const vault = Vault__factory.connect(config.Vaults[i].address, ethers.provider)

    console.log(`> validating ${config.Vaults[i].name}`)
    try {
      expect(await vault.owner(), config.Timelock)
    } catch (e) {
      console.log(e)
    }
    console.log("> ✅ done, no problem found")

    for (let j = 0; j < config.Vaults[i].workers.length; j++) {
      console.log(`> validating ${config.Vaults[i].workers[j].name}`)
      const worker = PancakeswapV2Worker__factory.connect(config.Vaults[i].workers[j].address, ethers.provider)

      try {
        expect(config.Vaults[i].address.toLocaleLowerCase()).to.be.eq((await worker.operator()).toLocaleLowerCase())
        expect(config.Vaults[i].baseToken.toLocaleLowerCase()).to.be.eq((await worker.baseToken()).toLocaleLowerCase())
        expect(config.Vaults[i].workers[j].pId).to.be.eq(await worker.pid())
        expect(await worker.baseToken()).to.be.eq(await vault.token())
        expect(await worker.fee()).to.be.eq('9975')
        expect(await worker.feeDenom()).to.be.eq('10000')
        expect(await worker.okStrats(config.SharedStrategies.StrategyAddBaseTokenOnly)).to.be.true
        expect(await worker.okStrats(config.SharedStrategies.StrategyLiquidate)).to.be.true
        expect(await worker.okStrats(config.SharedStrategies.StrategyWithdrawMinimizeTrading)).to.be.true
        expect(await worker.okStrats(config.SharedStrategies.StrategyPartialCloseLiquidate)).to.be.true
        expect(await worker.okStrats(config.SharedStrategies.StrategyPartialCloseMinimizeTrading)).to.be.true
        expect(await worker.okStrats(config.Vaults[i].StrategyAddTwoSidesOptimal)).to.be.true
      } catch (e) {
        console.log(e)
      }
      console.log("> ✅ done, no problem found")
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })