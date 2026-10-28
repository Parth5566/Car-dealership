const { query } = require("../config/db");
async function audit(actor, action, targetType, targetId, metadata = {}, db) {
  await query(
    "INSERT INTO nw_audit (actor_id,action,target_type,target_id,metadata) VALUES (?,?,?,?,?)",
    [
      actor || null,
      action,
      targetType,
      String(targetId),
      JSON.stringify(metadata),
    ],
    db,
  );
}
async function history(type, id, status, actor, note = "", db) {
  await query(
    "INSERT INTO nw_history (entity_type,entity_id,status,actor_id,note) VALUES (?,?,?,?,?)",
    [type, id, status, actor || null, note],
    db,
  );
}
function parse(row, fields = ["data", "metadata"]) {
  if (!row) return row;
  const out = { ...row };
  for (const key of fields) {
    if (typeof out[key] === "string") {
      try {
        out[key] = JSON.parse(out[key]);
      } catch {}
    }
  }
  return out;
}
async function images(vehicleId, db) {
  return query(
    "SELECT id,alt_text,sort_order FROM nw_images WHERE vehicle_id=? ORDER BY sort_order,id",
    [vehicleId],
    db,
  );
}
async function publicVehicle(row, db) {
  if (!row) return null;
  const v = parse(row);
  return {
    id: v.id,
    slug: v.slug,
    status: v.status,
    ...v.data,
    views: v.views,
    created_at: v.created_at,
    images: (await images(v.id, db)).map((i) => ({
      ...i,
      url: `/api/v1/media/${i.id}`,
    })),
  };
}
module.exports = { audit, history, parse, images, publicVehicle };
