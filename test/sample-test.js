const { expect } = require("chai");

describe("Hodl", function() {
  it("Should return the new greeting once it's changed", async function() {
    const HodlShare = await ethers.getContractFactory("HodlShare");
    const greeter = await HodlShare.deploy();
    
    // await greeter.deployed();
    // expect(await greeter.greet()).to.equal("Hello, world!");

    // await greeter.setGreeting("Hola, mundo!");
    // expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});
