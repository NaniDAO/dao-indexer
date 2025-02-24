import { ponder } from "ponder:registry";
import { dao, profile, governor, proposal, vote } from "ponder:schema";
import { daosData, profilesData, governorsData } from "../static_data";

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

  await context.db.insert(proposal).values({
    chainId: context.network.chainId.toString(),
    governor: event.log.address,
    proposalId,
    proposer: event.args.proposer,

    targets: event.args.targets,
    values: event.args.values,
    signatures: event.args.signatures,
    calldatas: event.args.calldatas,

    votingDelay: Number(voteStart) - Number(event.block.number),
    votingPeriod: Number(voteEnd) - Number(voteStart),
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
