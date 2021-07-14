import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { HodlERC20, MockERC20 } from "../typechain";
import { BigNumber, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("HodlERC20 Tests Without Bonus Token", function () {
  const provider = waffle.provider;
  const totalDuration = 86400 * 3; // 3 days period
  let expiry: BigNumber;
  let hodl: HodlERC20;
  let token: MockERC20;
  let bonusToken: MockERC20;
  let accounts: SignerWithAddress[] = [];

  let feeRecipient: SignerWithAddress;
  let donor: SignerWithAddress;
  let depositor: SignerWithAddress;

  const penalty = 50; // 5%
  const lockingWindow = 86400 * 1; // 1 day locking
  const name = "hodl WETH";
  const symbol = "hWETH";
  const fee = 50; //5% of penalty
  const n = 1; // linear decay

  this.beforeAll("Set accounts", async () => {
    const blockNumber = await provider.getBlockNumber();
    const currentBlock = await provider.getBlock(blockNumber);
    expiry = BigNumber.from(parseInt(currentBlock.timestamp.toString()) + totalDuration);

    accounts = await ethers.getSigners();
    const [depositor1, depositor2, _feeRecipient] = accounts;

    donor = depositor1;
    depositor = depositor2;
    feeRecipient = _feeRecipient;
  });

  this.beforeAll("Deploy HodlERC20", async () => {
    accounts = await ethers.getSigners();
    const HodlERC20 = await ethers.getContractFactory("HodlERC20");
    const contract = await HodlERC20.deploy();
    hodl = contract as HodlERC20;
  });

  this.beforeAll("Deploy Mock tokens", async () => {
    const ERC20 = await ethers.getContractFactory("MockERC20");
    const erc20 = await ERC20.deploy();
    const bonusErc20 = await ERC20.deploy();
    token = erc20 as MockERC20;
    bonusToken = bonusErc20 as MockERC20;
    await token.init("WETH", "WETH", 18);
    await bonusToken.init("BONUS", "BONUS", 18);

    // mint 10 WETH to depositor
    const mintAmount = utils.parseUnits("10", "ether");
    await token.mint(depositor.address, mintAmount);

    await hodl.init(
      token.address,
      penalty,
      lockingWindow,
      expiry,
      fee,
      n,
      feeRecipient.address,
      name,
      symbol,
      ethers.constants.AddressZero
    );
  });

  describe("pre-expiry", () => {
    describe("#donations", () => {
      it("Should fail if bonus token was not set up", async function () {
        const amountToDonate = utils.parseUnits("0.5");
        await expect(hodl.connect(donor).donate(amountToDonate, bonusToken.address)).to.be.revertedWith(
          "TOKEN_NOT_ALLOWED"
        );
      });
    });
  });
  describe("redemption", () => {
    it("Should not be able to redeem shares when there is no reward", async function () {
      const depositAmount = utils.parseUnits("1");
      await token.connect(depositor).approve(hodl.address, ethers.constants.MaxUint256);
      await hodl.connect(depositor).deposit(depositAmount, depositor.address);

      const hWethBalance = await hodl.balanceOf(depositor.address);
      expect(hWethBalance).to.eq(depositAmount);

      const sharesBefore = await hodl.shares(depositor.address);
      expect(sharesBefore.lt(depositAmount)).to.be.true;

      await hodl.connect(depositor).redeem(sharesBefore);
      const sharesAfter = await hodl.shares(depositor.address);
      expect(sharesBefore).to.eq(sharesAfter);
    });
  });
});
