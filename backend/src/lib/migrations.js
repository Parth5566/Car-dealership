// MySQL DDL can commit before a migration is recorded. Resume the simple nullable
// column additions used here by inspecting their definitions, never by ignoring
// duplicate-column errors or changing an existing column.
async function applyStatement(connection, statement) {
  const match = statement.match(/^ALTER TABLE (\w+) (ADD COLUMN .+)$/i);
  const definitions = match?.[2].split(",").map((value) => value.trim());
  const columns = definitions?.map((value) =>
    value.match(/^ADD COLUMN (\w+) (DATETIME|VARCHAR\([1-9]\d*\)) NULL$/i),
  );
  if (!match || columns.some((value) => !value)) {
    await connection.query(statement);
    return;
  }
  const table = match[1];
  const [existing] = await connection.execute(
    "SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table],
  );
  const missing = [];
  for (const [index, column] of columns.entries()) {
    const [, name, type] = column;
    const actual = existing.find(
      (item) => item.COLUMN_NAME.toLowerCase() === name.toLowerCase(),
    );
    if (!actual) missing.push(definitions[index]);
    else if (
      actual.COLUMN_TYPE.toLowerCase() !== type.toLowerCase() ||
      actual.IS_NULLABLE !== "YES" ||
      actual.COLUMN_DEFAULT !== null ||
      actual.EXTRA !== ""
    )
      throw new Error(
        `Cannot resume migration: incompatible column ${table}.${name}`,
      );
  }
  if (missing.length)
    await connection.query(`ALTER TABLE ${table} ${missing.join(", ")}`);
}
module.exports = { applyStatement };
