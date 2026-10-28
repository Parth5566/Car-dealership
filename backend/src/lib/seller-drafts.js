const { query, transaction } = require("../config/db");
const { fail } = require("./core");
const { history, audit } = require("./store");

// The saved submission is the durable notification. A contact event clears it
// without changing the vehicle's draft/review/publication status.
const draftContactedAt = `(SELECT MIN(h.created_at) FROM nw_history h
  WHERE h.entity_type='submission' AND h.entity_id=s.id AND h.status='draft_contacted')`;
const pendingDraftWhere = `s.status='draft' AND ${draftContactedAt} IS NULL`;

async function sellerDraftQueue() {
  const [[count], items] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total FROM nw_submissions s WHERE ${pendingDraftWhere}`,
    ),
    query(`SELECT s.id,s.type,s.created_at,
      JSON_UNQUOTE(JSON_EXTRACT(s.data,'$.make')) AS make,
      JSON_UNQUOTE(JSON_EXTRACT(s.data,'$.model')) AS model,
      JSON_UNQUOTE(JSON_EXTRACT(s.seller_contact,'$.name')) AS seller_name
      FROM nw_submissions s WHERE ${pendingDraftWhere} ORDER BY s.id LIMIT 5`),
  ]);
  return { total: Number(count.total), items };
}

async function markDraftContacted(submissionId, actorId) {
  return transaction(async (db) => {
    const [submission] = await query(
      "SELECT id,status FROM nw_submissions WHERE id=? FOR UPDATE",
      [submissionId],
      db,
    );
    if (!submission) fail(404, "Submission not found");
    if (submission.status !== "draft")
      fail(
        409,
        "This vehicle is no longer a draft. Open its latest review status.",
      );
    const [existing] = await query(
      "SELECT id FROM nw_history WHERE entity_type='submission' AND entity_id=? AND status='draft_contacted' LIMIT 1",
      [submissionId],
      db,
    );
    if (!existing) {
      await history(
        "submission",
        submissionId,
        "draft_contacted",
        actorId,
        "Staff recorded that they contacted the seller about completing this draft.",
        db,
      );
      await audit(
        actorId,
        "submission.draft_contacted",
        "submission",
        submissionId,
        {},
        db,
      );
    }
    return {
      message: "Seller contact recorded. The vehicle remains a private draft.",
    };
  });
}

module.exports = {
  draftContactedAt,
  pendingDraftWhere,
  sellerDraftQueue,
  markDraftContacted,
};
