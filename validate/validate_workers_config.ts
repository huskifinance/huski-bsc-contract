import { ethers, network } from "hardhat";
import "@openzeppelin/test-helpers";
import { WorkerConfig__factory } from "../typechain";
import MainnetConfig from '../deploy/results/mainnet.json'
import TestnetConfig from '../deploy/results/testnet.json'


async function queryWorkerConfigs(workerInfo: { name: any; address: any; config: any; pId?: number; }) {
  const workerConfig = WorkerConfig__factory.connect(workerInfo.config, ethers.provider)
  const isStable = await workerConfig.isStable(workerInfo.address)
  const config = await workerConfig.workers(workerInfo.address)
  console.log(`name: ${workerInfo.name}, isStable: ${isStable}, acceptDebt: ${config.acceptDebt}, 
  workFactor: ${config.workFactor}, killFactor: ${config.killFactor}, maxPriceDiff: ${config.maxPriceDiff}`)
}

async function main() {
  const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig
  
  for(let i = 0; i < config.Vaults.length; i++) {
    const promises = []
    for (const worker of config.Vaults[i].workers) {
      promises.push(
        queryWorkerConfigs(worker)
      )
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    await Promise.all(promises)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })