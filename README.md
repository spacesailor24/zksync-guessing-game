<!-- omit from toc -->
# Guessing Game

This project was scaffolded with [zksync-cli](https://github.com/matter-labs/zksync-cli).

- [Project Layout](#project-layout)
- [Project Considerations](#project-considerations)
- [How to Use](#how-to-use)
  - [Environment Settings](#environment-settings)
  - [Network Support](#network-support)
  - [Local Tests](#local-tests)
- [License](#license)

## Project Layout

- `/contracts`: Contains solidity smart contracts.
- `/deploy`: Scripts for contract deployment and interaction.
- `/test`: Test files.
- `hardhat.config.ts`: Configuration settings.

## Project Considerations

- This project utilizes ethers.js v5
  - This is due to [a bug](https://github.com/matter-labs/zksync-cli/issues/127) I came across trying to use v6
- I've opted to include the deployment of the `GUESS` token within the constructor of `GuessingGame`, instead of allowing an address of an existing token to be passed in `GuessingGame`'s `constructor`
  - The spec doesn't mention a preference, but it does say to: `Pre-mint some tokens in the constructor`. While possible to know the `GuessingGame`'s address ahead of time (utilizing a proxy deployer, or `CREATE2`), I've opted for the simpler approach of deploying a new instance of `GUESS` upon instantiation of `GuessingGame`, so that the pre-minted tokens are minted to `GuessingGame`, and no extra `approve` or `transfer` step needs to be done from the deployer of `GUESS` token to `GuessingGame` (so that `GuessingGame` has token to award correct guesses)
    - This does have a limitation that a new `GUESS` token is deployed each time a new `GuessingGame` is deployed i.e. a `GUESS` token contract cannot be reused
    - Additionally, I've added a `mint` function to `GuessingGame` that wraps `GuessingToken`'s `mint` function to allow the deployer (i.e. owner) of `GuessingGame` to mint additional token for `GuessingGame` if needed
      - I've hardcoded the address of `GuessingGame` as the recipient in this `mint` function, so that the `GuessingGame` owner can't mint tokens to any arbitary address
- `80%` of the contracts balance is always awarded for correct guesses, even if the first guess is correct
  - This means that if the first player to ever guess guesses correctly on their first try, they will only receive `80%` of their admission price
  - In my mind, it makes sense that the player should receive `100%` of the admission price since the spec says the admission price is only added to the contract's balance if the guess is incorrect:
    > If players don’t guess the correct number, the ETH value is added to the contract
    
    However, it also says that correct guess get `80%` of the contract's balance:
    > If players guess the number, they get 80% of the contract value plus 100 GUESS tokens

## How to Use

- `pnpm run compile`: Compiles contracts.
- `pnpm run deploy`: Deploys using script `/deploy/deploy.ts`.
- `pnpm run interact`: Interacts with the deployed contract using `/deploy/interact.ts`.
- `pnpm run test`: Tests the contracts.

### Environment Settings

To keep private keys safe, this project pulls in environment variables from `.env` files. Primarily, it fetches the wallet's private key.

Rename `.env.example` to `.env` and fill in your private key:

```
WALLET_PRIVATE_KEY=your_private_key_here...
```

### Network Support

`hardhat.config.ts` comes with a list of networks to deploy and test contracts. Add more by adjusting the `networks` section in the `hardhat.config.ts`. To make a network the default, set the `defaultNetwork` to its name. You can also override the default using the `--network` option, like: `hardhat test --network dockerizedNode`.

### Local Tests

Running `npm run test` by default runs the [zkSync In-memory Node](https://era.zksync.io/docs/tools/testing/era-test-node.html) provided by the [@matterlabs/hardhat-zksync-node](https://era.zksync.io/docs/tools/hardhat/hardhat-zksync-node.html) tool.

Important: zkSync In-memory Node currently supports only the L2 node. If contracts also need L1, use another testing environment like Dockerized Node. Refer to [test documentation](https://era.zksync.io/docs/tools/testing/) for details.

## License

This project is under the [MIT](./LICENSE) license.
