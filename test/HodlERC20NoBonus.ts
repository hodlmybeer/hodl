import { ethers } from 'hardhat';
import { expect } from 'chai';
import { HodlERC20, MockERC20 } from '../typechain';
import { BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('HodlERC20 Tests Without Bonus Token', function () {
  //TODO x2 is necessary because the main test batch fast-forward mines to expiry
  const totalDuration = 86400 * 3 * 2; // 3 days period
  const expiry = BigNumber.from(parseInt((Date.now() / 1000).toString()) + totalDuration);
  let hodl: HodlERC20;
  let token: MockERC20;
  let bonusToken: MockERC20;
  let accounts: SignerWithAddress[] = [];

  let feeRecipient: SignerWithAddress;
  let depositor1: SignerWithAddress;
  let depositor2: SignerWithAddress;
  let depositor3: SignerWithAddress;
  // let depositor4: SignerWithAddress;

  const penalty = 50; // 5%
  const lockingWindow = 86400 * 1; // 1 day locking
  const name = 'hodl WETH';
  const symbol = 'hWETH';
  const fee = 50; //5% of penalty
  const n = 1; // linear decay

  this.beforeAll('Set accounts', async () => {
    accounts = await ethers.getSigners();
    const [_depositor1, _depositor2, _depositor3, _feeRecipient] = accounts;

    depositor1 = _depositor1;
    depositor2 = _depositor2;
    depositor3 = _depositor3;
    feeRecipient = _feeRecipient;
  });

  this.beforeAll('Deploy HodlERC20', async () => {
    accounts = await ethers.getSigners();
    const HodlERC20 = await ethers.getContractFactory('HodlERC20');
    const contract = await HodlERC20.deploy();
    hodl = contract as HodlERC20;
  });

  this.beforeAll('Deploy Mock tokens', async () => {
    const ERC20 = await ethers.getContractFactory('MockERC20');
    const erc20 = await ERC20.deploy();
    const bonusErc20 = await ERC20.deploy();
    token = erc20 as MockERC20;
    bonusToken = bonusErc20 as MockERC20;
    await token.init('WETH', 'WETH', 18);
    await bonusToken.init('BONUS', 'BONUS', 18);

    // mint 100 WETH to account 0, 1 , 2, 3
    // every depositor got 10 weth
    const mintAmount = utils.parseUnits('10', 'ether');
    await token.mint(depositor1.address, mintAmount);
    await token.mint(depositor2.address, mintAmount);
    await bonusToken.mint(depositor2.address, mintAmount);
    await token.mint(depositor3.address, mintAmount);

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
      '0x0000000000000000000000000000000000000000',
    );
  });

  describe('pre-expiry', () => {
    describe('#donations', () => {
      it('Should fail if bonus token was not set up', async function () {
        const amountToDonate = utils.parseUnits('0.5');
        await expect(hodl.connect(depositor2).donate(amountToDonate, bonusToken.address)).to.be.revertedWith(
          'TOKEN_NOT_ALLOWED'
        );
      });
    })
  });

});
