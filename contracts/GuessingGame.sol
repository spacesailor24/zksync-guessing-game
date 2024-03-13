// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { GuessingToken } from "./erc20/GuessingToken.sol";

/**
 * @title A Guessing Game
 * @author spacesailor24
 * @notice This contract allows players to guess the secret number set by the contract owner
 *         in an attempt to win 80% of the contract's balance, and 100 GUESS tokens.
 */
contract GuessingGame is Ownable, ReentrancyGuard {
    /// @notice The price required to call the `guess` function.
    uint56 constant public ADMISSION_PRICE = 0.001 ether;
    /// @notice The amount of GUESS tokens rewarded for a correct guess.
    uint8 constant public TOKEN_REWARD_AMOUNT = 100;
    
    /// @notice The token that's awarded for correct guesses.
    GuessingToken immutable public guessingToken;

    /// @notice The keccak256 hash of a uint256 in hexidecimal that players
    ///         will attempt to guess via the `guess` method.
    bytes32 public secretNumberHash;

    event IncorrectGuess(uint256 guess);
    event CorrectGuess(uint256 guess, uint256 reward);

    error IncorrectAdmissionPrice(uint256 amountProvided, uint256 amountRequired);
    error FailedToTransferETHReward();
    error FailedToTransferGUESSReward();

    /**
     * @param _secretNumberHash The keccak256 hash of a uint256 in hexidecimal (padded to 32 bytes).
     * @notice A new instance of `GuessingToken` is deployed and used as the reward token for this contract.
     */
    constructor(bytes32 _secretNumberHash) Ownable() {
        guessingToken = new GuessingToken();
        secretNumberHash = _secretNumberHash;
    }

    /**
     * Usable by only the contract owner, update the hash of the secret number.
     * @param _newHash The new keccak256 hash of a uint256 in hexidecimal (padded to 32 bytes).
     */
    function setSecretNumberHash(bytes32 _newHash) public onlyOwner {
        secretNumberHash = _newHash;
    }

    /**
     * Mints a specified amount of tokens to the address of `guessingToken`. This method
     * is intended to be used to "top up" this contract's balance of reward tokens. 
     * @param _amount The amount of `guessingToken` to mint to this contract.
     * @notice Only the owner of this contract can call this method.
     */
    function mint(uint256 _amount) public onlyOwner {
        guessingToken.mint(address(this), _amount);
    }

    /**
     * Allows players to submit a number in attempt to guess the secret number set by the owner.
     * If the guess is incorrect, the `ADMISSION_PRICE` submitted by the player is kept and added to the
     * reward pot. If the guess is correct, the player is awarded 80% of the contract's balance, and 
     * `TOKEN_REWARD_AMOUNT` amount of `guessingToken`.
     * @param _guess The players guess, a uint256 in hexidecimal (padded to 32 bytes)
     *               e.g. `1` should be submitted as `0x0000000000000000000000000000000000000000000000000000000000000001`.
     * @notice `IncorrectGuess` event is emitted for incorrect guesses.
     * @notice `CorrectGuess` event is emitted for correct guesses.
     * @notice This contract makes use of OpenZeppelin's `nonReentrant` function modifier to protect the `.call`
     *         made to `msg.sender` on correct guesses.
     */
    function guess(uint256 _guess) public payable nonReentrant {
        if (msg.value != ADMISSION_PRICE) revert IncorrectAdmissionPrice(msg.value, ADMISSION_PRICE);

        if (keccak256(abi.encodePacked(_guess)) != secretNumberHash) {
            emit IncorrectGuess(_guess);
            return;
        }

        uint256 reward = rewardAmount();
        (bool success, ) = payable(msg.sender).call{value: reward}("");
        if (!success) revert FailedToTransferETHReward();

        success = guessingToken.transfer(msg.sender, TOKEN_REWARD_AMOUNT);
        if (!success) revert FailedToTransferGUESSReward(); 

        emit CorrectGuess(_guess, reward);
    }

    /**
     * Calculates 80% of the contract's current balance to be used as the reward amount.
     * @notice If the very first guess made is correct, the player will only be rewarded 80% of
     *         their `ADMISSION_PRICE` (plus `TOKEN_REWARD_AMOUNT`).
     * @return 80% of the contract's balance.
     */
    function rewardAmount() internal view returns (uint256) {
        return address(this).balance * 80 / 100;
    }
}
