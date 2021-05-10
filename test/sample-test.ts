import { ethers } from 'hardhat'

describe("HodlShare", function() {

  this.beforeAll("Deploy HodlShare", async () => {
    const HodlShare = await ethers.getContractFactory("HodlShare");
    const hodl  = await HodlShare.deploy();
  })

  it("Should deploy the contract", async function() {
  });
});
