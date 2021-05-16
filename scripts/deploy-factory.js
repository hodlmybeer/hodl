const hre = require('hardhat')

async function main() {

  // change this to the implementation address
  const implAddress = '0xaC8F621Ee9dEFADb61974b065Dd016517BE8d550'
  console.log(`Deploying Factory with implementation: ${implAddress}`)

  const HodlFactory = await hre.ethers.getContractFactory("HodlFactory");
  const factory = await HodlFactory.deploy(implAddress);

  await factory.deployed();

  console.log("Factory contract deployed at:", factory.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
