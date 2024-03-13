<template>
    <div id="app" v-if="!mainLoading">
      <h1>Guess the secret number!</h1>
      <h2>Current reward pool: {{ currentRewardPool }} ETH</h2>
      <div class="title">
        <p>In this game, a secret number has been chosen and it's your job to figure out what it is!</p>
        <p>It costs 0.001 ETH to guess, but if you guess correctly, you win 80% of the contract's balance and 100 GUESS tokens!</p>
        <p>
          The contract is deployed on the zkSync testnet on
          <a
            :href="`https://sepolia.explorer.zksync.io/address/${GUESSING_GAME_CONTRACT_ADDRESS}`"
            target="_blank"
            >{{ GUESSING_GAME_CONTRACT_ADDRESS }}</a
          >
        </p>
      </div>
      <div class="main-box">
        <p v-if="guessCorrect === false" style="color: red">Your guess of {{ submittedGuess }} was incorrect, try again?</p>
        <p v-if="guessCorrect" style="color: green">Your guess of {{ submittedGuess }} was correct!</p>
        <p v-if="guessCorrect" style="color: green">You were awarded: {{ awardedAmount }} ETH</p>

        <div class="greeting-input">
          <input
            v-model="playerGuess"
            placeholder="Enter your guess here..."
            type="text"
            @input="santizeForNumbers"
          />
  
          <button
            class="change-button"
            :disabled="guessTxStatus != 0"
            @click="guessSecretNumber"
          >
            <span v-if="!guessTxStatus">Guess</span>
            <span v-else-if="guessTxStatus === 1">Sending tx...</span>
            <span v-else-if="guessTxStatus === 2"
              >Waiting until tx is committed...</span
            >
            <span v-else-if="guessTxStatus === 3">Updating the page...</span>
          </button>
        </div>

        <div v-if="signerIsOwner">
          <p v-if="secretNumberUpdated" style="color: green">Secret number was updated!</p>

          <input
            v-model="newSecretNumber"
            placeholder="Enter new number here..."
            type="text"
            @input="santizeForNumbers"
          />
  
          <button
            class="change-button"
            :disabled="updateSecretNumberTxStatus != 0"
            @click="changeSecretNumber"
          >
            <span v-if="!updateSecretNumberTxStatus">Change</span>
            <span v-else-if="updateSecretNumberTxStatus === 1">Sending tx...</span>
            <span v-else-if="updateSecretNumberTxStatus === 2"
              >Waiting until tx is committed...</span
            >
            <span v-else-if="updateSecretNumberTxStatus === 3">Updating the page...</span>
          </button>
        </div>
      </div>
    </div>
    <div id="app" v-else>
      <div class="start-screen">
        <h1>Welcome to the Guessing Game!</h1>
        <button v-if="correctNetwork" @click="connectMetamask">
          Connect Metamask
        </button>
        <button v-else @click="addZkSyncSepolia">Switch to zkSync Sepolia</button>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted } from "vue";
  
  import { Contract, Provider } from "zksync-ethers";
  import { providers } from "ethers";
  import { hexZeroPad, hexlify, formatEther, Interface, keccak256 } from 'ethers/lib/utils';
  
  const GUESSING_GAME_CONTRACT_ADDRESS = "0x66F4a95B8fF0D65Dd0c722433d3dD8917194005B";
  import GUESSING_GAME_CONTRACT_ABI from "./abi.json";
  
  // reactive references
  const correctNetwork = ref(false);
  const currentRewardPool = ref("");
  const mainLoading = ref(true);
  // guessTxStatus is a reactive variable that tracks the status of the transaction
  // 0 stands for no status, i.e no tx has been sent
  // 1 stands for tx is beeing submitted to the operator
  // 2 stands for tx awaiting commit
  // 3 stands for updating the currentRewardPool on the page
  const guessTxStatus = ref(0);
  const updateSecretNumberTxStatus = ref(0);
  
  let provider: Provider | null = null;
  let signer: Wallet | null = null;
  let contract: Contract | null = null;
  let signerIsOwner: bool | null = null;

  let playerGuess = ref("");
  let newSecretNumber = ref("");
  let submittedGuess: string;
  let guessCorrect: bool | null = null;
  let awardedAmount: string;
  let secretNumberUpdated: bool | null = null;
  
  // Lifecycle hook
  onMounted(async () => {
    const network = await window.ethereum?.request<string>({
      method: "net_version",
    });
    if (network !== null && network !== undefined && +network === 300) {
      correctNetwork.value = true;
    }
  });
  
  // METHODS TO BE IMPLEMENTED
  const initializeProviderAndSigner = async () => {
    provider = new Provider("https://sepolia.era.zksync.dev");
    signer = await new providers.Web3Provider(window.ethereum).getSigner();
    contract = new Contract(GUESSING_GAME_CONTRACT_ADDRESS, GUESSING_GAME_CONTRACT_ABI, signer);

    signerIsOwner = await signer.getAddress() === await contract.owner();
  };
  
  const getCurrentRewardPool = async () => {
    const currentRewardPool = await provider.getBalance(GUESSING_GAME_CONTRACT_ADDRESS);
    return formatEther(currentRewardPool.toString());
  };
  
  const guessSecretNumber = async () => {
    resetNotifications();

    guessTxStatus.value = 1;
    try {
      const tx = await contract.guess(
        hexZeroPad(hexlify(parseInt(playerGuess.value), 32)),
        { value: await contract.ADMISSION_PRICE() }
      );

      guessTxStatus.value = 2;
  
      const receipt = await tx.wait();
      guessTxStatus.value = 3;
  
      currentRewardPool.value = await getCurrentRewardPool();

      const iface = new Interface(GUESSING_GAME_CONTRACT_ABI);
      const parsedLogs = receipt.logs.map(log => {
        try {
          return iface.parseLog(log);
        } catch (error) {
          return null;
        }
      }).filter(log => log !== null);

      const guessEvent = parsedLogs.find(log => log.name === "IncorrectGuess" || log.name === "CorrectGuess");
      guessCorrect = guessEvent.name === "CorrectGuess";
      submittedGuess = guessEvent.args.guess.toString();
      if (guessCorrect) awardedAmount = formatEther(guessEvent.args.reward);
    } catch (e) {
      console.error(e);
    }
  
    guessTxStatus.value = 0;
    playerGuess.value = "";
  };

  const changeSecretNumber = async () => {
    resetNotifications();

    updateSecretNumberTxStatus.value = 1;
    try {
      const tx = await contract.setSecretNumberHash(
        keccak256(hexZeroPad(hexlify(parseInt(newSecretNumber.value)), 32))
      );

      updateSecretNumberTxStatus.value = 2;
  
      const receipt = await tx.wait();
      if (receipt.status === 1) secretNumberUpdated = true;

      updateSecretNumberTxStatus.value = 3;
    } catch (e) {
      console.error(e);
    }
  
    updateSecretNumberTxStatus.value = 0;
    newSecretNumber.value = "";
  };

  const loadMainScreen = async () => {
    await initializeProviderAndSigner();
  
    if (!provider || !signer) {
      alert("Follow the tutorial to learn how to connect to Metamask!");
      return;
    }
  
    await getCurrentRewardPool()
      .then((amount) => (currentRewardPool.value = amount))
      .catch((e: unknown) => console.error(e));
  
    mainLoading.value = false;
  };

  const addZkSyncSepolia = async () => {
    // add zkSync testnet to Metamask
    await window.ethereum?.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x12C",
          chainName: "zkSync Sepolia testnet",
          rpcUrls: ["https://sepolia.era.zksync.dev"],
          blockExplorerUrls: ["https://sepolia.explorer.zksync.io/"],
          nativeCurrency: {
            name: "ETH",
            symbol: "ETH",
            decimals: 18,
          },
        },
      ],
    });
    window.location.reload();
  };

  const connectMetamask = async () => {
    await window.ethereum
      ?.request({ method: "eth_requestAccounts" })
      .catch((e: unknown) => console.error(e));
  
    loadMainScreen();
  };

  const santizeForNumbers = async (event) => {
    event.target.value = event.target.value.replace(/\D/g, '');
  }

  const resetNotifications = async () => {
    guessCorrect = null;
    secretNumberUpdated = null;
  }
  </script>
  
  <style scoped>
  input {
    width: 200px;
  }

  input,
  select {
    padding: 8px 3px;
    margin: 0 5px;
  }
  button {
    margin: 0 5px;
  }
  .title,
  .main-box,
  .greeting-input,
  .balance {
    margin: 10px;
  }
  </style>