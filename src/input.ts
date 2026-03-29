import { createInterface } from "node:readline/promises";
import { COLORS } from "./types.js";

const INPUT_PREFIX = `  ${COLORS.dim}→${COLORS.reset} `;
const NON_INTERACTIVE_ERROR =
  "Cannot read input: stdin is not interactive. Use env vars with dynamic body instead.";

export async function readInput(message: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error(NON_INTERACTIVE_ERROR);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(`${INPUT_PREFIX}${message}: `);
    return answer.trim();
  } finally {
    rl.close();
  }
}
