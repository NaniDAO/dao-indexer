import { ponder } from "ponder:registry";
import { proposal, vote } from "ponder:schema";

ponder.on("Governor:ProposalCreated", async ({ event, context }) => {
  // Create proposal record
  await context.db.insert(proposal).values({
    chainId: context.network.chainId.toString(),
    governor: event.log.address,
    proposalId: event.args.proposalId ?? event.args.id,
    proposer: event.args.proposer,

    targets: event.args.targets,
    values: event.args.values,
    signatures: event.args.signatures,
    calldatas: event.args.calldatas,

    votingDelay: Number(event.args.voteStart) - Number(event.block.number),
    votingPeriod: event.args.voteEnd - event.args.voteStart,
    voteStart: event.args.voteStart,
    voteEnd: event.args.voteEnd,

    description: event.args.description,
    status: "PENDING",

    createdAt: event.block.timestamp,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
  });
});

ponder.on("Governor:VoteCast", async ({ event, context }) => {
  // Map support value to enum
  const supportTypes = ["AGAINST", "FOR", "ABSTAIN"];
  const support = supportTypes[Number(event.args.support)];

  // Create vote record
  await context.db.insert(vote).values({
    chainId: context.network.chainId,
    governor: event.log.address,
    proposalId: event.args.proposalId ?? event.args.id,
    voter: event.args.voter,
    support,
    weight: event.args.weight,
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
      proposalId: event.args.proposalId ?? event.args.id,
    })
    .set((row) => {
      if (support === "FOR")
        return { forVotes: row.forVotes + event.args.weight };
      if (support === "AGAINST")
        return { againstVotes: row.againstVotes + event.args.weight };
      if (support === "ABSTAIN")
        return { abstainVotes: row.abstainVotes + event.args.weight };
      return {};
    });
});

// Handle status changes
ponder.on("Governor:ProposalCanceled", async ({ event, context }) => {
  await context.db
    .update(proposal, {
      chainId: context.network.chainId,
      governor: event.log.address,
      proposalId: event.args.proposalId ?? event.args.id,
    })
    .set(() => ({
      status: "CANCELED",
      cancelledAt: event.block.timestamp,
    }));
});

ponder.on("Governor:ProposalExecuted", async ({ event, context }) => {
  await context.db
    .update(proposal, {
      chainId: context.network.chainId.toString(),
      governor: event.log.address,
      proposalId: event.args.proposalId ?? event.args.id,
    })
    .set(() => ({
      status: "EXECUTED",
      executedAt: event.block.timestamp,
    }));
});

ponder.on("Governor:ProposalQueued", async ({ event, context }) => {
  await context.db
    .update(proposal, {
      chainId: context.network.chainId.toString(),
      governor: event.log.address,
      proposalId: event.args.proposalId ?? event.args.id,
    })
    .set({
      status: "QUEUED",
      queuedAt: event.block.timestamp,
      executableAt: event.args.eta,
    });
});
