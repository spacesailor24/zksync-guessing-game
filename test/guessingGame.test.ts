import { expect } from 'chai';
import { Contract, Wallet } from "zksync-ethers";
import { hexZeroPad, hexlify, keccak256, parseEther } from 'ethers/lib/utils';
import "@matterlabs/hardhat-zksync-chai-matchers";
import { BigNumber } from 'ethers';

import { getWallet, deployContract, LOCAL_RICH_WALLETS } from '../deploy/utils';

describe("GuessingGame", function () {
  const INITIAL_SECRET_NUMBER = 42;
  // In GuessingGame.sol, secret number is expected to be the hash of a uint256,
  // so we're padding INITIAL_SECRET_NUMBER to 32 bytes before hashing
  const INITIAL_SECRET_NUMBER_HASH = keccak256(hexZeroPad(hexlify(INITIAL_SECRET_NUMBER), 32));
  const NEW_SECRET_NUMBER = 24;
  const NEW_SECRET_NUMBER_HASH = keccak256(hexZeroPad(hexlify(NEW_SECRET_NUMBER), 32));

  let ownerWallet: Wallet;
  let userWallet: Wallet;
  let gameContract: Contract;
  let admissionPrice: BigNumber;
  let tokenContract: Contract;

  beforeEach(async function () {
    ownerWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    userWallet = getWallet(LOCAL_RICH_WALLETS[1].privateKey);

    gameContract = await deployContract("GuessingGame", [INITIAL_SECRET_NUMBER_HASH], { wallet: ownerWallet, silent: true });
    admissionPrice = await gameContract.ADMISSION_PRICE();
    tokenContract = new Contract(
      await gameContract.guessingToken(),
      ["function balanceOf(address account) view returns (uint256)"],
      ownerWallet
    );
  });

  it("Should set the initial secret number hash in constructor", async function () {
    const numberHash = await gameContract.secretNumberHash();
    expect(numberHash).to.equal(INITIAL_SECRET_NUMBER_HASH);
  });

  it("Should not allow userWallet to update the secret number hash", async function () {
    await expect(
        gameContract.connect(userWallet).setSecretNumberHash(NEW_SECRET_NUMBER_HASH)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    // Sanity check
    const numberHash = await gameContract.secretNumberHash();
    expect(numberHash).to.equal(INITIAL_SECRET_NUMBER_HASH);
  });

  it("Should allow ownerWallet to update the secret number hash", async function () {
    await gameContract.connect(ownerWallet).setSecretNumberHash(NEW_SECRET_NUMBER_HASH);

    const numberHash = await gameContract.secretNumberHash();
    expect(numberHash).to.equal(NEW_SECRET_NUMBER_HASH);
  });

  it("Should revert with IncorrectAdmissionPrice when 0 ETH is sent", async function () {
    const expectedValue = 0;
    await expect(
      gameContract.guess(INITIAL_SECRET_NUMBER)
    ).to.be.revertedWithCustomError(gameContract, "IncorrectAdmissionPrice").withArgs(expectedValue, admissionPrice);
  });

  it("Should revert with IncorrectAdmissionPrice when 1 ETH is sent (more than admission)", async function () {
    const expectedValue = parseEther('1');
    await expect(
      gameContract.guess(INITIAL_SECRET_NUMBER, { value: expectedValue })
    ).to.be.revertedWithCustomError(gameContract, "IncorrectAdmissionPrice").withArgs(expectedValue, admissionPrice);
  });

  it("Should revert with IncorrectAdmissionPrice when 0.0001 ETH is sent (less than admission)", async function () {
    const expectedValue = parseEther('0.0001');
    await expect(
      gameContract.guess(INITIAL_SECRET_NUMBER, { value: expectedValue })
    ).to.be.revertedWithCustomError(gameContract, "IncorrectAdmissionPrice").withArgs(expectedValue, admissionPrice);
  });

  it("Should emit IncorrectGuess, and should not send ether or tokens", async function() {
    await expect(
      gameContract.guess(
        // In GuessingGame.sol, secret number is expected to be the hash of a uint256,
        // so we're padding INITIAL_SECRET_NUMBER to 32 bytes before hashing
        hexZeroPad(hexlify(NEW_SECRET_NUMBER), 32),
        { value: admissionPrice }
    )).to.emit(gameContract, "IncorrectGuess").withArgs(NEW_SECRET_NUMBER);

    // Because the guess was incorrect, gameContract should have a balance of admissionPrice
    expect(await ownerWallet.provider.getBalance(gameContract.address)).equals(admissionPrice);

    // Assert that the guesser didn't receive any tokens
    expect(await tokenContract.balanceOf(ownerWallet.address)).equals(0);
  });

  it("Should emit CorrectGuess, transfer 80% of balance to guesser, and 100 tokens", async function() {
    const userBalanceBefore = await userWallet.provider.getBalance(userWallet.address);
    const gameContractBalanceBefore = await ownerWallet.provider.getBalance(gameContract.address);
    const expectedReward = gameContractBalanceBefore.add(admissionPrice).mul(80).div(100);

    const tx = await gameContract.connect(userWallet).guess(
        INITIAL_SECRET_NUMBER,
        { value: admissionPrice }
    );
    await expect(tx).to.emit(gameContract, "CorrectGuess").withArgs(INITIAL_SECRET_NUMBER, expectedReward)
    const receipt = await tx.wait();

    const userBalanceAfter = await userWallet.provider.getBalance(userWallet.address);
    const amountGasCharged = BigNumber.from(receipt.gasUsed).mul(BigNumber.from(receipt.effectiveGasPrice));
    expect(userBalanceBefore.sub(admissionPrice).sub(amountGasCharged).add(expectedReward)).equals(userBalanceAfter)

    // Remaning balance of gameContract should be 20% of admissionPrice since there was only 1 player
    expect(await ownerWallet.provider.getBalance(gameContract.address)).equals(admissionPrice.mul(20).div(100));

    // Guesser should receive TOKEN_REWARD_AMOUNT of tokens for correct guess
    expect(await tokenContract.balanceOf(userWallet.address)).equals(await gameContract.TOKEN_REWARD_AMOUNT())
  });

  it("Should emit CorrectGuess, transfer 80% of balance to guesser, and 100 tokens - with multiple players", async function() {
    let tx = await gameContract.connect(userWallet).guess(
        // In GuessingGame.sol, secret number is expected to be the hash of a uint256,
        // so we're padding INITIAL_SECRET_NUMBER to 32 bytes before hashing
        hexZeroPad(hexlify(NEW_SECRET_NUMBER), 32),
        { value: admissionPrice }
    );
    await expect(tx).to.emit(gameContract, "IncorrectGuess");
    await tx.wait();

    tx = await gameContract.connect(ownerWallet).guess(
        // In GuessingGame.sol, secret number is expected to be the hash of a uint256,
        // so we're padding INITIAL_SECRET_NUMBER to 32 bytes before hashing
        hexZeroPad(hexlify(1234), 32),
        { value: admissionPrice }
    );
    await expect(tx).to.emit(gameContract, "IncorrectGuess");
    await tx.wait();

    const userBalanceBefore = await userWallet.provider.getBalance(userWallet.address);
    const gameContractBalanceBefore = await ownerWallet.provider.getBalance(gameContract.address);
    const expectedReward = gameContractBalanceBefore.add(admissionPrice).mul(80).div(100);

    tx = await gameContract.connect(userWallet).guess(
        INITIAL_SECRET_NUMBER,
        { value: admissionPrice }
    );
    await expect(tx).to.emit(gameContract, "CorrectGuess").withArgs(INITIAL_SECRET_NUMBER, expectedReward)
    const receipt = await tx.wait();

    const userBalanceAfter = await userWallet.provider.getBalance(userWallet.address);
    const amountGasCharged = BigNumber.from(receipt.gasUsed).mul(BigNumber.from(receipt.effectiveGasPrice));
    expect(userBalanceBefore.sub(admissionPrice).sub(amountGasCharged).add(expectedReward)).equals(userBalanceAfter)

    // Remaning balance of gameContract should be 20% of gameContractBalanceBefore + admissionPrice
    // to account for the two previous incorrect guesses
    expect(await ownerWallet.provider.getBalance(gameContract.address))
        .equals(gameContractBalanceBefore.add(admissionPrice).mul(20).div(100));

    // Guesser should receive TOKEN_REWARD_AMOUNT of tokens for correct guess
    expect(await tokenContract.balanceOf(userWallet.address)).equals(await gameContract.TOKEN_REWARD_AMOUNT())
  });
});
