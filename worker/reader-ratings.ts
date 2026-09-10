/**
 * How the table stands, folded from the verdicts the sweep has written. Only the newest readings are read: the fold
 * forgets faster than the window ends, and the bound keeps the query flat as the table grows. Nothing is computed
 * here that a request has to wait for — the drifts were measured when the reading matured.
 */
import { ratings, type Drifts } from "../engine/index";

// Far past the memory of the fold, so the oldest reading in the window cannot move a star.
const WINDOW = 200;

export async function readReaderRatings(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT scores FROM readings WHERE origin = 'beat' AND scored_at IS NOT NULL ORDER BY anchor_ts DESC LIMIT ?1",
  )
    .bind(WINDOW)
    .all<{ scores: string }>();
  const verdicts = results.map((row) => JSON.parse(row.scores) as Drifts).reverse();
  const table = ratings(verdicts);
  return Response.json({
    verdicts: table[0]?.verdicts ?? 0,
    readers: table.map(({ reader, stars, wins }) => ({ reader, stars, wins })),
  });
}
