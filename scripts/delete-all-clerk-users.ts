/**
 * Delete every user from Clerk.
 *
 * Usage:
 *   pnpm delete:clerk-users -- --yes
 *   pnpm tsx scripts/delete-all-clerk-users.ts --yes
 *
 * Optional flags:
 *   --dry-run   List the users that would be deleted without deleting anything.
 *   --yes       Required to actually delete users.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

type CliArgs = {
  yes?: boolean;
  dryRun?: boolean;
};

type ClerkUserSummary = {
  id: string;
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
  }>;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--yes" || value === "-y") {
      args.yes = true;
      continue;
    }

    if (value === "--dry-run") {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPrimaryEmail(user: ClerkUserSummary) {
  return (
    user.emailAddresses.find((emailAddress) => emailAddress.id === user.primaryEmailAddressId)
      ?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "<no email>"
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is required");
  }

  if (!args.yes && !args.dryRun) {
    console.log(
      'Refusing to delete Clerk users without --yes. Run `pnpm delete:clerk-users -- --dry-run` first, then re-run with --yes.',
    );
    process.exit(1);
  }

  const { createClerkClient } = await import("@clerk/nextjs/server");
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  const PAGE_SIZE = 100;
  const DELETE_DELAY_MS = 150;

  let offset = 0;
  const clerkUsers: ClerkUserSummary[] = [];

  while (true) {
    const page = await clerk.users.getUserList({
      limit: PAGE_SIZE,
      offset,
      orderBy: "-created_at",
    });

    clerkUsers.push(...page.data);

    if (page.data.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
    await sleep(DELETE_DELAY_MS);
  }

  console.log(`Found ${clerkUsers.length} Clerk users.`);

  if (args.dryRun) {
    console.log("Dry run only. No users were deleted.");
    for (const user of clerkUsers) {
      console.log(`- ${user.id} ${getPrimaryEmail(user)}`);
    }
    return;
  }

  const summary = {
    deleted: 0,
    failed: 0,
  };

  for (const user of clerkUsers) {
    try {
      await clerk.users.deleteUser(user.id);
      summary.deleted += 1;
      console.log(`deleted: ${user.id} ${getPrimaryEmail(user)}`);
      await sleep(DELETE_DELAY_MS);
    } catch (error) {
      summary.failed += 1;
      console.error(`failed: ${user.id} ${getPrimaryEmail(user)}`, error);
    }
  }

  console.log("Summary:", summary);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});