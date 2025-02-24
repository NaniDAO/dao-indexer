import { createConfig, mergeAbis } from "ponder";
import { http } from "viem";

import { CompoundGovernorAbi } from "./abis/CompoundGovernorAbi";
import { GovernorBravoDelegatorAbi } from "./abis/GovernorBravoDelegatorAbi";
import { ENSGovernorAbi } from "./abis/ENSGovernorAbi";
import { GovernorBravoDelegateAbi } from "./abis/GovernorBravoDelegateAbi";
import { GitcoinGovernorAbi } from "./abis/GitcoinGovernorAbi";
import { NounsDaoLogicV2Abi } from "./abis/NounsDaoLogicV2Abi";
import { NounsDaoLogicV1Abi } from "./abis/NounsDaoLogicV1Abi";
import { NounsDaoLogicV3Abi } from "./abis/NounsDaoLogicV3Abi";
import { NounsDaoLogicV4Abi } from "./abis/NounsDaoLogicV4Abi";
import { HopGovernorAbi } from "./abis/HopGovernorAbi";

export default createConfig({
  networks: {
    mainnet: {
      chainId: 1,
      transport: http(process.env.PONDER_RPC_URL_1),
    },
  },
  contracts: {
    Governor: {
      network: "mainnet",
      abi: mergeAbis([
        // Compound Governance
        GovernorBravoDelegatorAbi,
        CompoundGovernorAbi,

        // ENS Governance
        ENSGovernorAbi,

        // GitcoinGovernor
        GitcoinGovernorAbi,

        // Uniswap
        GovernorBravoDelegateAbi,

        // LilNouns
        NounsDaoLogicV1Abi,
        NounsDaoLogicV2Abi,
        NounsDaoLogicV3Abi,
        NounsDaoLogicV4Abi,

        // HopGovernor
        HopGovernorAbi,
      ]),
      address: [
        "0xc0Da02939E1441F497fd74F78cE7Decb17B66529", // GovernorBravoDelegator (Compound)
        "0x309a862bbC1A00e45506cB8A802D1ff10004c8C0", // CompoundGovernor

        "0x323A76393544d5ecca80cd6ef2A560C6a395b7E3", // ENSGovernor

        "0x9D4C63565D5618310271bF3F3c01b2954C1D1639", // GitcoinGovernor

        "0x408ED6354d4973f66138C91495F2f2FCbd8724C3", // Uniswap

        "0x5d2C31ce16924C2a71D317e5BbFd5ce387854039", // LilNouns
        "0x6f3E6272A167e8AcCb32072d08E0957F9c79223d", // Nouns

        "0xed8Bdb5895B8B7f9Fdb3C087628FD8410E853D48", // HopGovernor
      ],
      startBlock: 12006099,
    },
  },
});
