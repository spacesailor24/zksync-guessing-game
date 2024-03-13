import { expect } from 'chai';
import { Contract, Wallet } from "zksync-ethers";
import { parseEther } from 'ethers/lib/utils';

import { getWallet, deployContract, LOCAL_RICH_WALLETS } from '../../deploy/utils';

describe("GuessingToken", function () {
  let tokenContract: Contract;
  let ownerWallet: Wallet;
  let userWallet: Wallet;

  before(async function () {
    ownerWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    userWallet = getWallet(LOCAL_RICH_WALLETS[1].privateKey);

    tokenContract = await deployContract("GuessingToken", [], { wallet: ownerWallet, silent: true });
  });

  it("Should have correct name", async function () {
    const name = await tokenContract.name();
    expect(name).to.equal("GuessingToken")
  });

  it("Should have correct symbol", async function () {
    const name = await tokenContract.symbol();
    expect(name).to.equal("GUESS")
  });

  it("Should have correct initial supply", async function () {
    const initialSupply = await tokenContract.totalSupply();
    expect(initialSupply.toString()).to.equal("100000000000000000000000"); // 100,000 tokens with 18 decimals
  });

  it("Should allow user to transfer tokens", async function () {
    const transferAmount = parseEther("50"); // Transfer 50 tokens
    const tx = await tokenContract.transfer(userWallet.address, transferAmount);
    await tx.wait();
    const userBalance = await tokenContract.balanceOf(userWallet.address);
    expect(userBalance.toString()).to.equal(transferAmount.toString());
  });
});
