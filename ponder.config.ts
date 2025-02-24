import { createConfig, mergeAbis } from "ponder";
import { http } from "viem";

import { ExampleContractAbi } from "./abis/ExampleContractAbi";
import { CompoundGovernorAbi } from "./abis/CompoundGovernorAbi";
import { GovernorBravoDelegatorAbi } from "./abis/GovernorBravoDelegatorAbi";
import { ENSGovernorAbi } from "./abis/ENSGovernorAbi";

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
      ]),
      address: [
        "0xc0Da02939E1441F497fd74F78cE7Decb17B66529", // GovernorBravoDelegator (Compound)
        "0x309a862bbC1A00e45506cB8A802D1ff10004c8C0", // CompoundGovernor

        "0x323A76393544d5ecca80cd6ef2A560C6a395b7E3", // ENSGovernor
      ],
      startBlock: 12006099,
    },
  },
});
