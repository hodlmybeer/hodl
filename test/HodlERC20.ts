import { ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { HodlERC20, MockERC20 } from '../typechain';
import { BigNumber, utils } from 'ethers';
import { calculateShares } from './utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('HodlERC20 Tests', function () {
  const provider = waffle.provider
  const expiry = BigNumber.from(parseInt((Date.now() / 1000).toString()) + 86400 * 30);
  let hodl: HodlERC20;
  let token: MockERC20;
  let totalTime: BigNumber
  let accounts: SignerWithAddress[] = [];

  let feeRecipient: SignerWithAddress;
  let depositor1: SignerWithAddress;
  let depositor2: SignerWithAddress;
  let depositor3: SignerWithAddress;
  // let depositor4: SignerWithAddress;

  this.beforeAll('Set accounts', async () => {
    accounts = await ethers.getSigners();
    const [ _depositor1, _depositor2, _depositor3, _feeRecipient ] = accounts

    depositor1 = _depositor1
    depositor2 = _depositor2
    depositor3 = _depositor3
    feeRecipient = _feeRecipient
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
    token = erc20 as MockERC20;
    await token.init('WETH', 'WETH', 18);

    // mint 100 WETH to account 0, 1 , 2, 3
    const amount = utils.parseUnits('100', 'ether');
    await token.mint(accounts[0].address, amount);
    await token.mint(accounts[1].address, amount);
    await token.mint(accounts[2].address, amount);
  });
  
  describe('creation', () => {
    describe('#init', () => {
      const penalty = 50; // 5%
      const lockingWindow = 86400 * 7;
      const name = 'hodl WETH';
      const symbol = 'hWETH';
      const fee = 50; //5% of penalty
      

      it('Should revert when init with invalid penalty', async function () {
        await expect(
          hodl.init(token.address, 1001, lockingWindow, expiry, fee, feeRecipient.address, name, symbol)
        ).to.be.revertedWith('INVALID_PENALTY');
      });

      it('Should revert when init with invalid expiry', async function () {
        const wrongExpiry = expiry.sub(86400 * 30);
        await expect(
          hodl.init(token.address, penalty, lockingWindow, wrongExpiry, fee, feeRecipient.address, name, symbol)
        ).to.be.revertedWith('INVALID_EXPIRY');
      });

      it('Should revert when init with locking window too long', async function () {
        const wrongLockingWindow = 86400 * 31;
        await expect(
          hodl.init(token.address, penalty, wrongLockingWindow, expiry, fee, feeRecipient.address, name, symbol)
        ).to.be.revertedWith('INVALID_EXPIRY');
      });

      it('Should init the contract', async function () {
        await hodl.init(token.address, penalty, lockingWindow, expiry, fee, feeRecipient.address, name, symbol);

        const _totalFee = await hodl.totalFee();
        const reward = await hodl.totalReward();
        const totalSupply = await hodl.totalSupply();
        const _expiry = await hodl.expiry();
        const _decimals = await hodl.decimals();
        const _name = await hodl.name();
        const _symbol = await hodl.symbol();
        
        totalTime = await hodl.totalTime()

        expect(_totalFee.isZero());
        expect(reward.isZero());
        expect(totalSupply.isZero());
        expect(_expiry.eq(expiry));
        expect(_decimals === 18, 'Wrong Decimal');
        expect(_name === name, 'Wrong Name');
        expect(_symbol === symbol, 'Wrong Symbol');
      });

      it('Should revert when trying to re-init', async function () {
        await expect(
          hodl.init(token.address, 0, 0, 0, 0, feeRecipient.address, name, symbol)
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });
  });

  describe('pre-expiry', () => {
    describe('#deposit', () => {
      it('Should deposit and get correct shares from depositor 1', async function () {
        await token.approve(hodl.address, ethers.constants.MaxUint256)
        // deposit 1 WETH
        const depositAmount = utils.parseUnits('1')
        
        // let time = Math.round(new Date().getTime() / 1000) + 86400
        const txRes = await hodl.deposit(depositAmount)
        const block =  await provider.getBlock(txRes.blockNumber)
        const blockTime = block.timestamp
        
        const hTokenBalance = await hodl.balanceOf(depositor1.address)
        expect(hTokenBalance.eq(depositAmount), "token amount mismatch");

        const d1Shares = await hodl.getShares(depositor1.address)
        const d1ShareToGet = calculateShares(depositAmount, totalTime, blockTime, expiry)
        
        expect(d1ShareToGet.eq(d1Shares));
      });
    });
    describe('#exist', () => {
      it('Should be able to quit', async function () {

      });
    });
    describe('#withdraw', () => {
      it('Should not be able to withdraw', async function () {});
    });
    describe('#redeem', () => {
      it('Should be able to redeem', async function () {});
    });
  });

  describe('post expiry', () => {
    describe('#deposit', () => {
      it('Should not be able to deposit', async function () {});
    });
    describe('#exist', () => {
      it('Should not be able to quit', async function () {});
    });
    describe('#withdraw', () => {
      it('Should be able to withdraw full amount', async function () {});
    });
    describe('#redeem', () => {
      it('Should be able to redeem', async function () {});
    });
  });
});
