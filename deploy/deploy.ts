import { hexZeroPad, hexlify, keccak256 } from "ethers/lib/utils";
import { deployContract } from "./utils";

export default async function () {
  const contractArtifactName = "GuessingGame";
  const guessingGameSecretNumber = 42;
  const constructorArguments = [
    keccak256(hexZeroPad(hexlify(guessingGameSecretNumber), 32))
  ];
  await deployContract(contractArtifactName, constructorArguments);
}
