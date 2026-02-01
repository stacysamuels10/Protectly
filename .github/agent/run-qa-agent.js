/**
 * QA Agent - Automated quality assurance assistant
 *
 * This agent:
 * 1. Compares qa branch to main
 * 2. Reviews changes from a QA perspective
 * 3. Either adds tests/fixes or comments with concerns
 * 4. Opens a PR to main when changes pass QA
 * 5. Never merges code
 */
import fs from "fs";
import { execSync } from "child_process";
import {
  initGitHub,
  compareBranches,
  createPR,
  addComment,
  getOwnerRepo,
} from "./lib/github.js";
import { initAI, reviewChangesForQA } from "./lib/ai.js";
import { applyFileChanges, readFiles, getFileContext } from "./lib/files.js";

// Load configuration
const config = JSON.parse(fs.readFileSync(".github/agent/config.json", "utf8"));

/**
 * Run shell command and return output
 */
function run(cmd, options = {}) {
  console.log(`$ ${cmd}`);
  try {
    const result = execSync(cmd, {
      encoding: "utf-8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    });
    return result;
  } catch (err) {
    if (options.ignoreError) return null;
    throw err;
  }
}

/**
 * Check if there are uncommitted changes
 */
function hasChanges() {
  const status = run("git status --porcelain", { silent: true });
  return status && status.trim().length > 0;
}

/**
 * Get the diff between qa and main branches
 */
function getDiff() {
  return run("git diff origin/main...origin/qa", { silent: true }) || "";
}

/**
 * Check if qa branch has changes compared to main
 */
function hasBranchDiff() {
  const diff = getDiff();
  return diff.trim().length > 0;
}

/**
 * Find existing QA PR from qa to main
 */
async function findExistingQAPR() {
  const { Octokit } = await import("@octokit/rest");
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const { owner, repo } = getOwnerRepo();

  const { data: pulls } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    head: `${owner}:qa`,
    base: "main",
  });

  return pulls[0] || null;
}

/**
 * Main QA agent loop
 */
async function main() {
  console.log("=================================");
  console.log("QA Agent starting...");
  console.log(`Dry run: ${config.dryRun}`);
  console.log("=================================\n");

  // Initialize APIs
  initGitHub(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY);
  initAI(process.env.OPENAI_API_KEY);

  // Fetch latest branches
  run("git fetch origin main qa", { ignoreError: true });

  // Check if there are differences between qa and main
  if (!hasBranchDiff()) {
    console.log("No differences between qa and main branches. Nothing to QA.");
    return;
  }

  console.log("Found changes in qa branch compared to main.");

  // Get comparison details
  const comparison = await compareBranches("main", "qa");

  console.log(`Commits ahead: ${comparison.ahead_by}`);
  console.log(`Files changed: ${comparison.files?.length || 0}`);

  if (!comparison.files || comparison.files.length === 0) {
    console.log("No file changes to review.");
    return;
  }

  // Get the diff for AI review
  const diff = getDiff();

  // Limit diff size for AI context
  const truncatedDiff =
    diff.length > 50000 ? diff.slice(0, 50000) + "\n... (truncated)" : diff;

  // Ask AI to review changes
  console.log("\nAsking AI to review changes...");
  const qaReview = await reviewChangesForQA(
    truncatedDiff,
    comparison.files,
    config
  );

  console.log("\n=== QA REVIEW ===");
  console.log(JSON.stringify(qaReview, null, 2));
  console.log("=================\n");

  // Handle uncertain verdict
  if (qaReview.verdict === "uncertain") {
    console.log("QA Agent is uncertain. Leaving comments instead of changes.");

    if (config.dryRun) {
      console.log("[DRY RUN] Would comment on qa branch with concerns.");
      return;
    }

    // Find or note concerns
    const existingPR = await findExistingQAPR();
    if (existingPR) {
      await addComment(
        existingPR.number,
        `🤖 **QA Agent Review - Uncertain**

I reviewed the changes but have concerns that need human judgment:

${qaReview.concerns?.map((c) => `- ${c}`).join("\n") || "No specific concerns listed."}

**Summary:** ${qaReview.summary}

*Please review and address these concerns.*`
      );
      console.log(`Added comment to existing PR #${existingPR.number}`);
    } else {
      console.log(
        "No existing PR to comment on. Consider creating a qa->main PR manually."
      );
    }
    return;
  }

  // Handle needs_changes verdict
  if (qaReview.verdict === "needs_changes") {
    console.log("QA Agent found issues to address.");

    // Collect all changes (fixes + tests)
    const allChanges = [];

    if (qaReview.suggestedFixes) {
      for (const fix of qaReview.suggestedFixes) {
        allChanges.push({
          path: fix.path,
          action: fix.action,
          content: fix.content,
        });
      }
    }

    if (qaReview.testsToAdd) {
      for (const test of qaReview.testsToAdd) {
        allChanges.push({
          path: test.path,
          action: "create",
          content: test.content,
        });
      }
    }

    if (allChanges.length === 0) {
      console.log(
        "No concrete changes suggested. Leaving comments instead."
      );

      if (!config.dryRun) {
        const existingPR = await findExistingQAPR();
        if (existingPR) {
          await addComment(
            existingPR.number,
            `🤖 **QA Agent Review - Needs Changes**

${qaReview.concerns?.map((c) => `- ${c}`).join("\n") || ""}

**Summary:** ${qaReview.summary}`
          );
        }
      }
      return;
    }

    console.log(`Preparing ${allChanges.length} changes...`);

    if (config.dryRun) {
      console.log("[DRY RUN] Would apply the following changes:");
      for (const change of allChanges) {
        console.log(`  - ${change.action}: ${change.path}`);
      }
      return;
    }

    // Create a QA fix branch
    const qaBranch = `agent/qa/fixes-${Date.now()}`;
    run(`git checkout qa`);
    run(`git pull origin qa`);
    run(`git checkout -b ${qaBranch}`);

    // Apply changes
    const results = applyFileChanges(allChanges);
    console.log("Applied changes:", results);

    // Run tests
    console.log("\nRunning tests...");
    try {
      run(config.testCommand);
    } catch (err) {
      console.error("Tests failed after applying QA fixes. Aborting.");
      run("git checkout qa");
      run(`git branch -D ${qaBranch}`, { ignoreError: true });
      return;
    }

    console.log("Tests passed!");

    if (!hasChanges()) {
      console.log("No actual changes to commit.");
      run("git checkout qa");
      run(`git branch -D ${qaBranch}`, { ignoreError: true });
      return;
    }

    // Commit and push
    run("git add .");
    run(`git commit -m "QA Agent: Add tests and fixes

${qaReview.summary}"`);
    run(`git push origin ${qaBranch}`);

    // Create PR to qa branch (not main - QA fixes go to qa first)
    const pr = await createPR({
      title: "QA Agent: Tests and fixes",
      head: qaBranch,
      base: "qa",
      body: `## Summary
${qaReview.summary}

## Changes
${allChanges.map((c) => `- \`${c.path}\` (${c.action})`).join("\n")}

## Concerns Addressed
${qaReview.concerns?.map((c) => `- ${c}`).join("\n") || "None"}

---
🤖 *This PR was created by the QA Agent.*
*Human review required before merging.*`,
    });

    console.log(`\n✅ QA fixes PR created: ${pr.html_url}`);
    return;
  }

  // Handle pass verdict
  if (qaReview.verdict === "pass") {
    console.log("QA Agent approves the changes!");

    if (config.dryRun) {
      console.log("[DRY RUN] Would create/update PR from qa to main.");
      return;
    }

    // Check for existing PR
    const existingPR = await findExistingQAPR();

    if (existingPR) {
      console.log(`Found existing qa->main PR #${existingPR.number}`);

      // Add approval comment
      await addComment(
        existingPR.number,
        `🤖 **QA Agent Review - Passed**

${qaReview.summary}

✅ All changes have been reviewed and pass QA checks.

*Ready for human review and merge.*`
      );

      console.log("Added approval comment to existing PR.");
    } else {
      // Create new PR from qa to main
      const pr = await createPR({
        title: "Release: qa → main",
        head: "qa",
        base: "main",
        body: `## QA Agent Review

${qaReview.summary}

## Files Changed
${comparison.files.map((f) => `- \`${f.filename}\` (${f.status})`).join("\n")}

## Commits
${comparison.commits?.map((c) => `- ${c.commit.message.split("\n")[0]}`).join("\n") || ""}

---
🤖 *This PR was created by the QA Agent after reviewing all changes.*
*Human approval required before merging to main.*`,
      });

      console.log(`\n✅ qa->main PR created: ${pr.html_url}`);
    }
  }
}

// Run the agent
main().catch((err) => {
  console.error("QA Agent failed with error:", err);
  process.exit(1);
});
