import { onchainEnum, onchainTable, primaryKey, relations } from "ponder";

export const proposalStatus = onchainEnum("status", [
  "PENDING",
  "ACTIVE",
  "CANCELED",
  "DEFEATED",
  "SUCCEEDED",
  "QUEUED",
  "EXPIRED",
  "EXECUTED",
  "VETOED",
]);

export const supportType = onchainEnum("supportType", [
  "FOR",
  "AGAINST",
  "ABSTAIN",
]);

export const voteType = onchainEnum("voteType", [
  "SIMPLE_MAJORITY",
  "SIMPLE_MAJORITY_QUORUM_REQUIRED",
  "SUPERMAJORITY",
  "SUPERMAJORITY_QUORUM_REQUIRED",
]);

// ===============================
// Core DAO
// ===============================

export const dao = onchainTable("dao", (t) => ({
  id: t.text().primaryKey(),
}));

export const daoRelations = relations(dao, ({ one, many }) => ({
  profile: one(profile, {
    fields: [dao.id],
    references: [profile.daoId],
  }),
  governors: many(governor),
  kali: many(kali),
}));

export const profile = onchainTable("profile", (t) => ({
  daoId: t.text().primaryKey(),
  name: t.text(),
  description: t.text(),
  logo: t.text(),
  website: t.text(),
  forum: t.text(),
  twitter: t.text(),
  discord: t.text(),
}));

// ===============================
// KaliDAO
// ===============================

export const kali = onchainTable(
  "kali",
  (t) => ({
    daoId: t.text().notNull(),

    chainId: t.numeric().notNull(),
    address: t.hex().notNull(),

    name: t.text().notNull(),
    symbol: t.text().notNull(),
    decimals: t.integer().notNull(), // Always 18
    docs: t.text(),

    votingPeriod: t.integer().notNull(),
    gracePeriod: t.integer().notNull(),
    quorum: t.integer().notNull(),
    supermajority: t.integer().notNull(),

    mintVoteType: voteType().notNull(),
    burnVoteType: voteType().notNull(),
    callVoteType: voteType().notNull(),
    periodVoteType: voteType().notNull(),
    gracePeriodVoteType: voteType().notNull(),
    quorumVoteType: voteType().notNull(),
    supermajorityVoteType: voteType().notNull(),
    typeVoteType: voteType().notNull(),
    pauseVoteType: voteType().notNull(),
    extensionVoteType: voteType().notNull(),
    escapeVoteType: voteType().notNull(),
    docsVoteType: voteType().notNull(),

    totalSupply: t.bigint().notNull(),
    paused: t.boolean().notNull(),

    createdAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainId, table.address],
    }),
  }),
);

export const kaliRelations = relations(kali, ({ one, many }) => ({
  dao: one(dao, {
    fields: [kali.daoId],
    references: [dao.id],
  }),
  proposals: many(kaliProposal),
}));

export const kaliProposal = onchainTable(
  "kaliProposal",
  (t) => ({
    chainId: t.numeric().notNull(),
    kali: t.hex().notNull(),
    proposalId: t.bigint().notNull(),

    proposer: t.hex().notNull(),
    proposalType: t.integer().notNull(), // KaliDAO.ProposalType enum
    description: t.text().notNull(),
    prevProposal: t.bigint(),

    sponsor: t.hex(),
    sponsored: t.boolean(),

    yesVotes: t.bigint().notNull(),
    noVotes: t.bigint().notNull(),

    accounts: t.hex().array(),
    amounts: t.bigint().array(),
    payloads: t.hex().array(),

    status: proposalStatus().notNull(),

    creationTime: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainId, table.kali, table.proposalId],
    }),
  }),
);

export const kaliProposalRelations = relations(
  kaliProposal,
  ({ one, many }) => ({
    kali: one(kali, {
      fields: [kaliProposal.chainId, kaliProposal.kali],
      references: [kali.chainId, kali.address],
    }),
    votes: many(kaliVote),
  }),
);

export const kaliMember = onchainTable(
  "kaliMember",
  (t) => ({
    chainId: t.numeric().notNull(),
    kali: t.hex().notNull(),
    address: t.hex().notNull(),

    tokenBalance: t.bigint().notNull(),
    votingPower: t.bigint().notNull(), // delegated voting power
    delegate: t.hex(),

    lastYesVote: t.bigint(), // track last yes vote for rage quit
    proposalsVoted: t.bigint(),

    firstJoinedAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainId, table.kali, table.address],
    }),
  }),
);

export const kaliMemberRelations = relations(kaliMember, ({ one, many }) => ({
  kali: one(kali, {
    fields: [kaliMember.chainId, kaliMember.kali],
    references: [kali.chainId, kali.address],
  }),
  votes: many(kaliVote),
}));

export const kaliVote = onchainTable(
  "kaliVote",
  (t) => ({
    chainId: t.numeric().notNull(),
    kali: t.hex().notNull(),
    proposalId: t.bigint().notNull(),
    voter: t.hex().notNull(),

    approve: t.boolean().notNull(),

    weight: t.bigint().notNull(), // weight at time of vote

    transactionHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainId, table.kali, table.proposalId, table.voter],
    }),
  }),
);

export const kaliVoteRelations = relations(kaliVote, ({ one }) => ({
  proposal: one(kaliProposal, {
    fields: [kaliVote.chainId, kaliVote.kali, kaliVote.proposalId],
    references: [
      kaliProposal.chainId,
      kaliProposal.kali,
      kaliProposal.proposalId,
    ],
  }),
  member: one(kaliMember, {
    fields: [kaliVote.chainId, kaliVote.kali, kaliVote.voter],
    references: [kaliMember.chainId, kaliMember.kali, kaliMember.address],
  }),
}));

// ===============================
// Governor
// ===============================

export const governor = onchainTable(
  "governor",
  (t) => ({
    daoId: t.text().notNull(),

    chainId: t.numeric().notNull(),
    address: t.hex().notNull(),
    token: t.hex().notNull(),
    timelock: t.hex(),

    type: t.text(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainId, table.address],
    }),
  }),
);

export const governorRelation = relations(governor, ({ one, many }) => ({
  dao: one(dao, {
    fields: [governor.daoId],
    references: [dao.id],
  }),
  proposals: many(proposal),
}));

// A single Governor proposal.
export const proposal = onchainTable(
  "proposal",
  (t) => ({
    /**
     * Composite Primary Key
     *
     * ChainId, Governor address and proposalId (uint256)
     */
    chainId: t.numeric().notNull(),
    governor: t.hex().notNull(),
    proposalId: t.bigint().notNull(),

    /** The address that created the proposal. */
    proposer: t.text(),

    /**
     * The arrays emitted in the "ProposalCreated" event.
     * Usually these are parallel arrays (targets[i], values[i], signatures[i], calldatas[i])
     */
    targets: t.hex().array(),
    values: t.bigint().array(),
    signatures: t.hex().array(),
    calldatas: t.hex().array(),

    /** Voting schedule. */
    votingDelay: t.bigint(),
    votingPeriod: t.bigint(),
    voteStart: t.bigint(),
    voteEnd: t.bigint(),

    /** The full description text from the proposal. */
    description: t.text().notNull(),

    /**
     * The EIP-712 typed message hash or proposal "descriptionHash" as used
     * by Governor to queue/execute.
     */
    descriptionHash: t.text(),

    /**
     * Status of the proposal: one of
     * "PENDING", "ACTIVE", "CANCELED", "DEFEATED", "SUCCEEDED",
     * "QUEUED", "EXPIRED", "EXECUTED", "VETOED"
     */
    status: proposalStatus().notNull(),

    /** Voting tally. */
    forVotes: t.bigint(),
    againstVotes: t.bigint(),
    abstainVotes: t.bigint(),

    /**
     * Status change timestamp
     */
    createdAt: t.bigint().notNull(),
    queuedAt: t.bigint(),
    executableAt: t.bigint(),
    cancelledAt: t.bigint(),
    executedAt: t.bigint(),

    /**
     * Proposal Metadata
     * `guardian` is same as vetoer on nouns
     */
    guardian: t.hex(),
    quorum: t.bigint(),
    approval: t.bigint(),
    proposalThreshold: t.bigint(),

    /** Additional event/transaction metadata. */
    transactionHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainId, table.governor, table.proposalId],
    }),
  }),
);

export const proposalRelations = relations(proposal, ({ one, many }) => ({
  governor: one(governor, {
    fields: [proposal.chainId, proposal.governor],
    references: [governor.chainId, governor.address],
  }),
  votes: many(vote),
}));

// Each "VoteCast" from a Governor.
export const vote = onchainTable(
  "vote",
  (t) => ({
    /**
     * Composite Primary key for the vote.
     * `${chainId}-${governorAddress}-${proposalId}-${voter}`
     */
    chainId: t.numeric().notNull(),
    governor: t.hex().notNull(),
    proposalId: t.bigint().notNull(),
    voter: t.hex().notNull(),

    /**
     * The support value (0 = Against, 1 = For, 2 = Abstain),
     * typically an enum in Governor Bravo/Compound-style governors.
     */
    support: supportType().notNull(),

    /** The voting weight/power at the block of the vote. */
    weight: t.bigint(),

    /** Optional: the reason for the vote. */
    reason: t.text(),

    /** Additional event/transaction metadata. */
    transactionHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainId, table.governor, table.proposalId, table.voter],
    }),
  }),
);

export const voteRelations = relations(vote, ({ one }) => ({
  proposal: one(proposal, {
    fields: [vote.chainId, vote.governor, vote.proposalId],
    references: [proposal.chainId, proposal.governor, proposal.proposalId],
  }),
}));
