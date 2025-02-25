import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql, desc, eq, and, or } from "ponder";
import { Address } from "viem";

const app = new Hono();

app.get("/daos", async (c) => {
  try {
    const daos = await db.select().from(schema.dao);
    return c.json({ daos });
  } catch (error) {
    console.error("Error fetching DAOs:", error);
    return c.json({ error: "Internal server error", daos: [] }, 500);
  }
});

app.get("/dao/:daoId", async (c) => {
  const daoId = c.req.param("daoId");
  try {
    const [dao] = await db
      .select()
      .from(schema.dao)
      .where(eq(schema.dao.id, daoId));
    if (!dao) {
      return c.json({ error: "DAO not found" }, 404);
    }

    const [profile] = await db
      .select()
      .from(schema.profile)
      .where(eq(schema.profile.daoId, daoId));

    return c.json({
      dao: {
        ...dao,
        profile: profile || null,
      },
    });
  } catch (error) {
    console.error("Error fetching DAO:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get("/dao/:daoId/governors", async (c) => {
  const daoId = c.req.param("daoId");
  try {
    const governors = await db
      .select()
      .from(schema.governor)
      .where(eq(schema.governor.daoId, daoId));
    if (!governors.length) {
      return c.json({ error: "No governors found for this DAO" }, 404);
    }
    return c.json({ governors });
  } catch (error) {
    console.error("Error fetching governors:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /dao/:daoId/proposals
 * --------------------------------
 * Returns proposals for all governors under a given DAO.
 */
app.get("/dao/:daoId/proposals", async (c) => {
  const daoId = c.req.param("daoId");
  const limit = Number(c.req.query("limit") ?? 10);
  const offset = Number(c.req.query("offset") ?? 0);

  try {
    // Fetch the governors for this DAO
    const governors = await db
      .select()
      .from(schema.governor)
      .where(eq(schema.governor.daoId, daoId));

    if (governors.length === 0) {
      return c.json(
        {
          error: "DAO not found or has no governors",
          proposals: [],
        },
        404,
      );
    }

    // Build an OR condition for each governor
    // so that (chainId, governor) must match
    const orConditions = governors.map((g) =>
      and(
        eq(schema.proposal.chainId, g.chainId),
        eq(schema.proposal.governor, g.address),
      ),
    );

    const proposalsRaw = await db
      .select()
      .from(schema.proposal)
      .where(or(...orConditions))
      .orderBy(desc(schema.proposal.createdAt))
      .limit(limit)
      .offset(offset);

    // Massage bigints and such
    const proposals = proposalsRaw.map((proposal) => ({
      ...proposal,
      proposalId: proposal.proposalId.toString(),
      values: proposal.values?.map((v) => v.toString()),
      votingDelay: proposal.votingDelay?.toString(),
      votingPeriod: proposal.votingPeriod?.toString(),
      voteStart: proposal.voteStart?.toString(),
      voteEnd: proposal.voteEnd?.toString(),
      forVotes: proposal.forVotes?.toString(),
      againstVotes: proposal.againstVotes?.toString(),
      abstainVotes: proposal.abstainVotes?.toString(),
      createdAt: proposal.createdAt.toString(),
      queuedAt: proposal.queuedAt?.toString(),
      executableAt: proposal.executableAt?.toString(),
      cancelledAt: proposal.cancelledAt?.toString(),
      executedAt: proposal.executedAt?.toString(),
      quorum: proposal.quorum?.toString(),
      approval: proposal.approval?.toString(),
      proposalThreshold: proposal.proposalThreshold?.toString(),
      blockNumber: proposal.blockNumber.toString(),
    }));

    return c.json({
      proposals,
      metadata: {
        limit,
        offset,
        count: proposals.length,
      },
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return c.json(
      {
        error: "Internal server error",
        proposals: [],
      },
      500,
    );
  }
});

app.get(
  "/dao/:daoId/proposals/:chainId/:governorAddress/:proposalId",
  async (c) => {
    const { daoId, chainId, governorAddress, proposalId } = c.req.param();

    try {
      const [governor] = await db
        .select()
        .from(schema.governor)
        .where(
          and(
            eq(schema.governor.daoId, daoId),
            eq(schema.governor.chainId, chainId),
            eq(schema.governor.address, governorAddress as Address),
          ),
        );

      if (!governor) {
        return c.json({ error: "Governor not found for this DAO" }, 404);
      }

      // Fetch the proposal now
      const [proposal] = await db
        .select()
        .from(schema.proposal)
        .where(
          and(
            eq(schema.proposal.chainId, chainId),
            eq(schema.proposal.governor, governorAddress as Address),
            eq(schema.proposal.proposalId, BigInt(proposalId)),
          ),
        );

      if (!proposal) {
        return c.json({ error: "Proposal not found" }, 404);
      }

      return c.json({ proposal });
    } catch (error) {
      console.error("Error fetching proposal:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  },
);

app.get(
  "/dao/:daoId/proposals/:chainId/:governorAddress/:proposalId/votes",
  async (c) => {
    const { daoId, chainId, governorAddress, proposalId } = c.req.param();

    try {
      const [governor] = await db
        .select()
        .from(schema.governor)
        .where(
          and(
            eq(schema.governor.daoId, daoId),
            eq(schema.governor.chainId, chainId),
            eq(schema.governor.address, governorAddress as Address),
          ),
        );

      if (!governor) {
        return c.json({ error: "Governor not found for this DAO" }, 404);
      }

      // Fetch the votes
      const votesRaw = await db
        .select()
        .from(schema.vote)
        .where(
          and(
            eq(schema.vote.chainId, chainId),
            eq(schema.vote.governor, governorAddress as Address),
            eq(schema.vote.proposalId, BigInt(proposalId)),
          ),
        )
        .orderBy(eq(schema.vote.blockNumber, schema.vote.blockNumber)); // or however you want to sort

      // Convert BigInts
      const votes = votesRaw.map((vote) => ({
        ...vote,
        blockNumber: vote.blockNumber.toString(),
        blockTimestamp: vote.blockTimestamp.toString(),
        weight: vote.weight?.toString(),
      }));

      return c.json({ votes });
    } catch (error) {
      console.error("Error fetching votes:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  },
);

app.use("/graphql", graphql({ db, schema }));

export default app;
