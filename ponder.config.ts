import { createConfig, mergeAbis, factory } from "ponder";
import { http, parseAbiItem } from "viem";

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

import { KaliDAOAbi } from "./abis/KaliDAOAbi";
import { KaliDAOFactoryAbi } from "./abis/KaliDAOFactoryAbi";

export default createConfig({
  networks: {
    mainnet: {
      chainId: 1,
      transport: http(process.env.PONDER_RPC_URL_1),
    },
    arbitrum: {
      chainId: 42161,
      transport: http(process.env.PONDER_RPC_URL_42161),
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
    KaliDAOFactory: {
      abi: KaliDAOFactoryAbi,
      network: {
        mainnet: {
          address: "0x8bD48C45d40724E8424C3aAa4097257A38A98024",
          startBlock: 12369621,
        },
        arbitrum: {
          address: "0x045cbcBA76a7EcF82d0f6B5DCc0881B3C12E37d0",
          startBlock: 6018052,
        },
      },
    },
    KaliDAO: {
      abi: KaliDAOAbi,
      network: {
        mainnet: {
          startBlock: 12369621,
        },
        arbitrum: {
          startBlock: 6018052,
        },
      },
      address: factory({
        address: [
          "0x8bD48C45d40724E8424C3aAa4097257A38A98024",
          "0x045cbcBA76a7EcF82d0f6B5DCc0881B3C12E37d0",
        ],
        event: parseAbiItem(
          "event DAOdeployed(address indexed kaliDAO, string name, string symbol, string docs, bool paused, address[] extensions, bytes[] extensionsData, address[] voters, uint256[] shares, uint32[16] govSettings)",
        ),
        parameter: "kaliDAO",
      }),
    },
  },
});
