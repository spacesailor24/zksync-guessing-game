<!-- omit from toc -->
# Guessing Game

This project contains a Guessing Game contract where the owner of the game sets the `keccak256` hash of a secret number. Players then pay an addmission fee (`0.001 ether`) to attempt to guess the secret number. If their guess is incorrect, their admission fee gets added to the reward pool. If the guess is correct, the player gets `80%` of the reward pool, plus `100 GUESS` tokens.

A dApp that utilizes a deployed version of this game on zksync Sepolia, is available at:

[guessing-game.spacesailor.dev](https://guessing-game.spacesailor.dev/)

The `GUESS` token contract address on zksync Sepolia: [0x52606D135bDfdDe9f34dbC185261dee0bc42B236](https://sepolia.explorer.zksync.io/address/0x52606D135bDfdDe9f34dbC185261dee0bc42B236#transactions)

The `GuessingGame` contract address on zksync Sepolia: [0x66F4a95B8fF0D65Dd0c722433d3dD8917194005B](https://sepolia.explorer.zksync.io/address/0x66F4a95B8fF0D65Dd0c722433d3dD8917194005B#transactions)

<!-- omit from toc -->
## Table of Contents

- [Project Layout](#project-layout)
- [Project Considerations](#project-considerations)
- [Running this Project](#running-this-project)
  - [Getting Started](#getting-started)
  - [NPM Scripts](#npm-scripts)
  - [Environment Settings](#environment-settings)
  - [Network Support](#network-support)
  - [Local Tests](#local-tests)
- [License](#license)

## Project Layout

This project was scaffolded with [zksync-cli](https://github.com/matter-labs/zksync-cli).

Contracts:

- `/contracts`: Contains solidity smart contracts.
- `/deploy`: Scripts for contract deployment and interaction.
- `/test`: Test files.
- `hardhat.config.ts`: Configuration settings.

Frontend:

- `/frontend`: Contains the Vue.js frontend

## Project Considerations

- This project utilizes ethers.js v5
  - This is due to [a bug](https://github.com/matter-labs/zksync-cli/issues/127) I came across trying to use v6
- I've opted to include the deployment of the `GUESS` token within the constructor of `GuessingGame` instead of allowing an address of an existing token to be passed in `GuessingGame`'s `constructor`
  - The spec doesn't mention a preference, but it does say to: `Pre-mint some tokens in the constructor`. While it's possible to know the `GuessingGame`'s address ahead of time (utilizing a proxy deployer, or `CREATE2`), I've opted for the simpler approach of deploying a new instance of `GuessingToken` upon instantiation of `GuessingGame`. The pre-minted tokens are then minted to `GuessingGame`, resulting in no need for an extra `approve` or `transfer` step to give `GuessingGame` tokens to award correct guesses
    - This does have a limitation that a new `GuessingToken` is deployed each time a new `GuessingGame` is deployed i.e. an existing `GuessingToken` contract cannot be reused for multiple games
    - Additionally, I've added a `mint` function to `GuessingGame` that wraps `GuessingToken`'s `mint` function to allow the deployer (i.e. owner) of `GuessingGame` to mint additional token for `GuessingGame` if needed
      - I've hardcoded the address of `GuessingGame` as the recipient in this `mint` function, so that the `GuessingGame` owner can't mint tokens to an arbitary address
- `80%` of the contracts balance is always awarded for correct guesses, even if the first guess is correct
  - This means that if the first player to ever guess guesses correctly on their first try, they will only receive `80%` of their admission price
  - In my mind, it makes sense that the player should receive `100%` of the admission price since the spec says the admission price is only added to the contract's balance if the guess is incorrect:
    > If players don’t guess the correct number, the ETH value is added to the contract
    
    However, it also says that correct guess get `80%` of the contract's balance:
    > If players guess the number, they get 80% of the contract value plus 100 GUESS tokens

## Running this Project

### Getting Started

1. `git clone git@github.com:spacesailor24/zksync-guessing-game.git`
2. `pnpm i`

- `pnpm run test` Will compile the contracts and run the tests
- `pnpm run deploy --network zkSyncSepoliaTestnet` Will deploy the contracts to zksync Sepolia
  - This steps requires a private key to be specified in `.env` (See [Environment Settings](#environment-settings))
- `pnpm run dev` Will start the Vue.js frontend and serve it locally
  - The frontend is preconfigured to communicate with the deployed `GuessingGame` on zksync Sepolia

### NPM Scripts

- `pnpm run dev`: Starts the frontend on a `localhost` server.
- `pnpm run build`: Builds the Vue.js frontend for deployment.
- `pnpm run preview`: Serves the production-ready build locally for previewing before deployment.
- `pnpm run deploy`: Deploys using script `/deploy/deploy.ts`.
- `pnpm run compile`: Compiles contracts.
- `pnpm run clean`: Runs `hardhat clean`.
- `pnpm run test`: Tests the contracts using a local backend.

### Environment Settings

To keep private keys safe, this project pulls in environment variables from `.env` files. Primarily, it fetches the wallet's private key used for contract deployment.

Rename `.env.example` to `.env` and fill in your private key:

```
WALLET_PRIVATE_KEY=your_private_key_here...
```

### Network Support

`hardhat.config.ts` comes with a list of networks to deploy and test contracts. Add more by adjusting the `networks` section in the `hardhat.config.ts`. To make a network the default, set the `defaultNetwork` to its name. You can also override the default using the `--network` option, like: `hardhat test --network dockerizedNode`.

### Local Tests

Running `pnpm run test` by default runs the [zkSync In-memory Node](https://era.zksync.io/docs/tools/testing/era-test-node.html) provided by the [@matterlabs/hardhat-zksync-node](https://era.zksync.io/docs/tools/hardhat/hardhat-zksync-node.html) tool.

Important: zkSync In-memory Node currently supports only the L2 node. If contracts also need L1, use another testing environment like Dockerized Node. Refer to [test documentation](https://era.zksync.io/docs/tools/testing/) for details.

## License

This project is under the [MIT](./LICENSE) license.
