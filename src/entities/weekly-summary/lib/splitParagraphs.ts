/** A recap section's `body` is one JSON string. Blank lines inside it are the agent's
    paragraph breaks, so split on them and render one <p> per paragraph — a single
    pre-wrapped block reads like a wall, which is the opposite of the point.
    Bodies with no blank line (every recap filed so far) come back as one paragraph. */
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
