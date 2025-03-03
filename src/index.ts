import { ponder } from "ponder:registry";
import {
  dao,
  profile,
  governor,
  proposal,
  vote,
  kali,
  kaliMember,
  kaliProposal,
  kaliVote,
} from "ponder:schema";
import { daosData, profilesData, governorsData } from "../static_data";
import { Address } from "viem";

ponder.on("Governor:setup", async ({ context }) => {
  // setup all static metadata
  await context.db.insert(dao).values(daosData);
  await context.db.insert(profile).values(profilesData);
  await context.db.insert(governor).values(governorsData);
});

ponder.on("Governor:ProposalCreated", async ({ event, context }) => {
  // Handle different parameter structures
  const proposalId = event.args.proposalId ?? event.args.id;
  const voteStart = event.args.voteStart ?? event.args.startBlock;
  const voteEnd = event.args.voteEnd ?? event.args.endBlock;

  const { client } = context;
  const { Governor } = context.contracts;

  /* @TODO
   * TEMPORARY: .catch(() => 0n) is a workaround while investigating failing votingDelay/Period reads
   * on proposal tx: 0x4f9e1c4922670d55f0dfaaa45c7c580570b29b2139c655e5ff9f29ddf8eaf3d4
   * ContractFunctionZeroDataError: The contract function "votingDelay" returned no data ("0x")
   */
  const votingDelay = await client
    .readContract({
      abi: Governor.abi,
      address: event.log.address,
      functionName: "votingDelay",
    })
    .catch(() => 0n);
  const votingPeriod = await client
    .readContract({
      abi: Governor.abi,
      address: event.log.address,
      functionName: "votingPeriod",
    })
    .catch(() => 0n);

  await context.db.insert(proposal).values({
    chainId: context.network.chainId.toString(),
    governor: event.log.address,
    proposalId,
    proposer: event.args.proposer,

    targets: event.args.targets,
    values: event.args.values,
    signatures: event.args.signatures,
    calldatas: event.args.calldatas,

    votingDelay: votingDelay,
    votingPeriod: votingPeriod,
    voteStart,
    voteEnd,

    description: event.args.description,
    status: "PENDING",

    createdAt: event.block.timestamp,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
  });
});

ponder.on("Governor:VoteCast", async ({ event, context }) => {
  const supportTypes = ["AGAINST", "FOR", "ABSTAIN"];
  const support = supportTypes[Number(event.args.support)];

  // Handle different weight/votes parameter
  const weight = event.args.weight ?? event.args.votes;
  const proposalId = event.args.proposalId ?? event.args.id;

  await context.db.insert(vote).values({
    chainId: context.network.chainId,
    governor: event.log.address,
    proposalId,
    voter: event.args.voter,
    support,
    weight,
    reason: event.args.reason,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });

  // Update proposal vote counts
  await context.db
    .update(proposal, {
      chainId: context.network.chainId.toString(),
      governor: event.log.address,
      proposalId,
    })
    .set((row) => {
      if (support === "FOR")
        return { forVotes: (row.forVotes ?? 0n) + BigInt(weight) };
      if (support === "AGAINST")
        return { againstVotes: (row.againstVotes ?? 0n) + BigInt(weight) };
      if (support === "ABSTAIN")
        return { abstainVotes: (row.abstainVotes ?? 0n) + BigInt(weight) };
      return {};
    });
});

// Handle status changes with unified proposalId access
const handleStatusChange = (status: string) => {
  return async ({ event, context }) => {
    const proposalId = event.args.proposalId ?? event.args.id;

    await context.db
      .update(proposal, {
        chainId: context.network.chainId.toString(),
        governor: event.log.address,
        proposalId,
      })
      .set(
        status === "QUEUED"
          ? {
              status,
              queuedAt: event.block.timestamp,
              executableAt: event.args.eta,
            }
          : {
              status,
              [`${status.toLowerCase()}At`]: event.block.timestamp,
            },
      );
  };
};

ponder.on("Governor:ProposalCanceled", handleStatusChange("CANCELED"));
ponder.on("Governor:ProposalExecuted", handleStatusChange("EXECUTED"));
ponder.on("Governor:ProposalQueued", handleStatusChange("QUEUED"));

/************
 * KALI
 *************/

const validateDocs = async (docs: string): Promise<undefined | string> => {
  docs = docs.toLowerCase();

  if (docs == "na" || docs == "none") {
    return undefined;
  }

  if (docs.startsWith("Qm") || docs.startsWith("bafy")) {
    return "ipfs://" + docs;
  }

  return docs;
};

export type VoteType =
  | "SIMPLE_MAJORITY"
  | "SIMPLE_MAJORITY_QUORUM_REQUIRED"
  | "SUPERMAJORITY"
  | "SUPERMAJORITY_QUORUM_REQUIRED";

const toVoteType = (type: number): VoteType => {
  switch (type) {
    case 0:
      return "SIMPLE_MAJORITY";
    case 1:
      return "SIMPLE_MAJORITY_QUORUM_REQUIRED";
    case 2:
      return "SUPERMAJORITY";
    case 3:
      return "SUPERMAJORITY_QUORUM_REQUIRED";
    default:
      throw new Error(`Invalid vote type: ${type}`);
  }
};

// Handle new DAO deployment
ponder.on("KaliDAOFactory:DAOdeployed", async ({ event, context }) => {
  const { args } = event;
  const daoId = args.name.toLowerCase().replace(/\s/g, "");
  const docs = await validateDocs(args.docs);
  await context.db
    .insert(dao)
    .values({
      id: daoId,
    })
    .onConflictDoNothing(); // we are indexing all kali permissionlessly so this may clash with existing dao ids and group those kali together

  await context.db
    .insert(profile)
    .values({
      daoId,
      name: args.name,
      // Can fetch these details from docs (usually hosted on ipfs if available)
      // description: t.text(),
      // logo: t.text(),
      // website: t.text(),
      // forum: t.text(),
      // twitter: t.text(),
      // discord: t.text(),
    })
    .onConflictDoNothing();

  await context.db.insert(kali).values({
    daoId,
    chainId: context.network.chainId.toString(),
    address: args.kaliDAO,
    name: args.name,
    symbol: args.symbol,
    decimals: 18,
    docs: docs,

    votingPeriod: args.govSettings[0],
    gracePeriod: args.govSettings[1],
    quorum: args.govSettings[2],
    supermajority: args.govSettings[3],

    mintVoteType: toVoteType(args.govSettings[4]),
    burnVoteType: toVoteType(args.govSettings[5]),
    callVoteType: toVoteType(args.govSettings[6]),
    periodVoteType: toVoteType(args.govSettings[7]),
    gracePeriodVoteType: toVoteType(args.govSettings[8]),
    quorumVoteType: toVoteType(args.govSettings[9]),
    supermajorityVoteType: toVoteType(args.govSettings[10]),
    typeVoteType: toVoteType(args.govSettings[11]),
    pauseVoteType: toVoteType(args.govSettings[12]),
    extensionVoteType: toVoteType(args.govSettings[13]),
    escapeVoteType: toVoteType(args.govSettings[14]),
    docsVoteType: toVoteType(args.govSettings[15]),

    totalSupply: args.shares.reduce((a, b) => a + b, 0n), // Sum of initial shares
    paused: args.paused,
    createdAt: event.block.timestamp,
  });
});

// Handle delegation changes
ponder.on("KaliDAO:DelegateChanged", async ({ event, context }) => {
  await context.db
    .update(kaliMember, {
      chainId: context.network.chainId.toString(),
      kali: event.log.address,
      address: event.args.delegator,
    })
    .set({
      delegate: event.args.toDelegate,
      updatedAt: event.block.timestamp,
    });
});

// Handle voting power changes
ponder.on("KaliDAO:DelegateVotesChanged", async ({ event, context }) => {
  await context.db
    .insert(kaliMember)
    .values({
      chainId: context.network.chainId.toString(),
      kali: event.log.address,
      address: event.args.delegate,
      votingPower: event.args.newBalance,
      tokenBalance: 0n,
      firstJoinedAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
      proposalsVoted: 0n,
    })
    .onConflictDoUpdate({
      votingPower: event.args.newBalance,
      updatedAt: event.block.timestamp,
    });
});

ponder.on("KaliDAO:NewProposal", async ({ event, context }) => {
  await context.db.insert(kaliProposal).values({
    chainId: context.network.chainId.toString(),
    kali: event.log.address,
    proposalId: event.args.proposal,

    proposer: event.args.proposer,
    proposalType: event.args.proposalType,
    description: event.args.description,

    accounts: [...event.args.accounts],
    amounts: [...event.args.amounts],
    payloads: [...event.args.payloads],

    yesVotes: 0n,
    noVotes: 0n,
    status: "ACTIVE",

    creationTime: event.block.timestamp,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
  });
});

ponder.on("KaliDAO:VoteCast", async ({ event, context }) => {
  const { voter, proposal, approve } = event.args;

  const { client } = context;
  const { KaliDAO } = context.contracts;

  const weight = await client.readContract({
    abi: KaliDAO.abi,
    address: event.log.address,
    functionName: "getCurrentVotes",
    args: [voter as Address],
  });

  await context.db.insert(kaliVote).values({
    chainId: context.network.chainId.toString(),
    kali: event.log.address,
    proposalId: proposal,
    voter: voter,
    approve: approve,
    weight,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });

  await context.db
    .insert(kaliMember)
    .values({
      chainId: context.network.chainId.toString(),
      kali: event.log.address,
      address: voter,
      votingPower: weight,
      tokenBalance: 0n,
      firstJoinedAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
      proposalsVoted: 1n,
      lastYesVote: approve ? event.block.timestamp : null,
    })
    .onConflictDoUpdate((member) => ({
      proposalsVoted: (member.proposalsVoted ?? 0n) + 1n,
      lastYesVote: approve ? event.block.timestamp : member.lastYesVote,
      updatedAt: event.block.timestamp,
    }));

  // Update proposal vote counts
  await context.db
    .update(kaliProposal, {
      chainId: context.network.chainId.toString(),
      kali: event.log.address,
      proposalId: proposal,
    })
    .set((proposal) => ({
      yesVotes: approve ? proposal.yesVotes + weight : proposal.yesVotes,
      noVotes: !approve ? proposal.noVotes + weight : proposal.noVotes,
    }));
});

// Handle proposal processing
ponder.on("KaliDAO:ProposalProcessed", async ({ event, context }) => {
  await context.db
    .update(kaliProposal, {
      chainId: context.network.chainId.toString(),
      kali: event.log.address,
      proposalId: event.args.proposal,
    })
    .set({
      status: event.args.didProposalPass == true ? "EXECUTED" : "DEFEATED",
    });
});

// Handle transfers for member balances
ponder.on("KaliDAO:Transfer", async ({ event, context }) => {
  const amount = event.args.amount;
  const isInitialMint =
    event.args.from === "0x0000000000000000000000000000000000000000";

  // For new members or updates
  await context.db
    .insert(kaliMember)
    .values({
      chainId: context.network.chainId.toString(),
      kali: event.log.address,
      address: event.args.to,
      tokenBalance: amount,
      votingPower: isInitialMint ? amount : 0n, // For initial mint, voting power = balance
      firstJoinedAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
      proposalsVoted: 0n,
    })
    .onConflictDoUpdate((row) => ({
      tokenBalance: row.tokenBalance + amount,
      updatedAt: event.block.timestamp,
    }));

  // Update sender balance if not a mint
  if (!isInitialMint) {
    await context.db
      .update(kaliMember, {
        chainId: context.network.chainId.toString(),
        kali: event.log.address,
        address: event.args.from,
      })
      .set((member) => ({
        tokenBalance: member.tokenBalance - amount,
        updatedAt: event.block.timestamp,
      }));
  }

  // Update total supply
  if (isInitialMint) {
    // Don't need to update totalSupply here since we set it in DAOdeployed
    return;
  }

  await context.db
    .update(kali, {
      chainId: context.network.chainId.toString(),
      address: event.log.address,
    })
    .set((dao) => ({
      totalSupply:
        event.args.to === "0x0000000000000000000000000000000000000000"
          ? dao.totalSupply - amount
          : dao.totalSupply,
    }));
});

ponder.on("KaliDAO:PauseFlipped", async ({ event, context }) => {
  await context.db
    .update(kali, {
      chainId: context.network.chainId.toString(),
      address: event.log.address,
    })
    .set({
      paused: event.args.paused,
    });
});

ponder.on("KaliDAO:ProposalSponsored", async ({ event, context }) => {
  await context.db
    .update(kaliProposal, {
      chainId: context.network.chainId.toString(),
      kali: event.log.address,
      proposalId: event.args.proposal,
    })
    .set({
      sponsor: event.args.sponsor,
      sponsored: true,
    });
});

ponder.on("KaliDAO:ProposalCancelled", async ({ event, context }) => {
  await context.db
    .update(kaliProposal, {
      chainId: context.network.chainId.toString(),
      kali: event.log.address,
      proposalId: event.args.proposal,
    })
    .set({
      status: "CANCELED",
    });
});
