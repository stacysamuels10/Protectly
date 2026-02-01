/**
 * Dev Agent - Daily automated development assistant
 *
 * This agent:
 * 1. Reads the current active GitHub milestone
 * 2. Finds open issues labeled 'agent-ok'
 * 3. Decides if exactly one issue is safe to work on
 * 4. Implements the issue and opens a PR to the qa branch
 * 5. Can incorporate feedback from existing PRs
 */
import fs from "fs";
import { execSync } from "child_process";
import {
  initGitHub,
  getActiveMilestone,
  getCandidateIssues,
  hasSkipLabel,
  findExistingPR,
  getPRComments,
  createPR,
  addComment,
  getFileContent,
} from "./lib/github.js";
import {
  initAI,
  pickIssue,
  generateImplementation,
  applyFeedback,
  identifyRelevantFiles,
} from "./lib/ai.js";
import {
  applyFileChanges,
  readFiles,
  listFilesRecursive,
  getFileContext,
} from "./lib/files.js";

// Load configuration
const config = JSON.parse(fs.readFileSync(".github/agent/config.json", "utf8"));

// Skip labels - issues with these labels are not worked on
const SKIP_LABELS = ["agent-hold", "needs-design"];

/**
 * Output the decision in the required format
 */
function logDecision(decision) {
  console.log("\n=== AGENT DECISION ===");
  console.log(JSON.stringify(decision, null, 2));
  console.log("======================\n");
}

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
 * Filter issues to only those safe to work on
 */
function filterSafeIssues(issues) {
  return issues.filter((issue) => {
    // Skip if has skip labels
    if (hasSkipLabel(issue, SKIP_LABELS)) {
      console.log(`Skipping #${issue.number}: has skip label`);
      return false;
    }

    // Skip if no body (no acceptance criteria possible)
    if (!issue.body || issue.body.trim().length < 20) {
      console.log(`Skipping #${issue.number}: no description or too short`);
      return false;
    }

    return true;
  });
}

/**
 * Gather context for implementation
 */
async function gatherContext(issue) {
  console.log("Identifying relevant files...");

  // Ask AI which files might be relevant
  const relevantFiles = await identifyRelevantFiles(issue, config);

  // Read relevant files from disk
  const filesToRead = [];

  // Add explicitly identified files
  for (const file of relevantFiles.files || []) {
    if (fs.existsSync(file)) {
      filesToRead.push(file);
    }
  }

  // Scan identified directories
  for (const dir of relevantFiles.directories || []) {
    if (fs.existsSync(dir)) {
      const files = listFilesRecursive(dir, [".ts", ".tsx", ".js", ".jsx"]);
      filesToRead.push(...files.slice(0, 10)); // Limit to 10 files per dir
    }
  }

  // Get file contents as context
  const existingFiles = getFileContext(filesToRead.slice(0, 20)); // Max 20 files

  return { existingFiles };
}

/**
 * Handle an existing PR (incorporate feedback)
 */
async function handleExistingPR(issue, pr) {
  console.log(`Found existing PR #${pr.number} for issue #${issue.number}`);

  // Get comments on the PR
  const { reviewComments, issueComments } = await getPRComments(pr.number);

  // Filter to human comments only (not from bots)
  const humanComments = [...reviewComments, ...issueComments].filter(
    (c) => !c.user.login.includes("bot") && !c.user.login.includes("[bot]")
  );

  if (humanComments.length === 0) {
    console.log("No new human feedback to address.");
    return { action: "skip", reason: "No new feedback" };
  }

  console.log(`Found ${humanComments.length} human comments to address.`);

  // Checkout the existing branch
  const branch = `agent/dev/issue-${issue.number}`;
  run(`git fetch origin ${branch}`);
  run(`git checkout ${branch}`);

  // Get current changes in the branch
  const diffOutput = run(`git diff origin/${config.baseBranch}...HEAD`, {
    silent: true,
  });

  // Apply feedback
  const feedback = humanComments.map((c) => ({
    user: c.user.login,
    body: c.body,
  }));

  const updatedImplementation = await applyFeedback(
    issue,
    { currentDiff: diffOutput },
    feedback,
    config
  );

  if (
    !updatedImplementation.files ||
    updatedImplementation.files.length === 0
  ) {
    console.log("No changes needed based on feedback.");
    return { action: "skip", reason: "Feedback addressed or not actionable" };
  }

  // Apply changes
  const results = applyFileChanges(updatedImplementation.files);
  console.log("Applied changes:", results);

  return {
    action: "update",
    implementation: updatedImplementation,
    prNumber: pr.number,
  };
}

/**
 * Main agent loop
 */
async function main() {
  console.log("=================================");
  console.log("Dev Agent starting...");
  console.log(`Dry run: ${config.dryRun}`);
  console.log(`Confidence threshold: ${config.confidenceThreshold}`);
  console.log("=================================\n");

  // Initialize APIs
  initGitHub(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY);
  initAI(process.env.OPENAI_API_KEY);

  // Get active milestone
  const milestone = await getActiveMilestone();
  if (!milestone) {
    console.log("No active milestone found. Exiting.");
    logDecision({
      decision: "skip",
      issueNumber: null,
      confidence: 0,
      reason: "No active milestone",
    });
    return;
  }

  console.log(`Active milestone: ${milestone.title}`);

  // Get candidate issues
  const allIssues = await getCandidateIssues(milestone.number);
  console.log(`Found ${allIssues.length} issues with 'agent-ok' label`);

  const safeIssues = filterSafeIssues(allIssues);
  console.log(`${safeIssues.length} issues pass safety filters`);

  if (safeIssues.length === 0) {
    console.log("No safe issues to work on. Exiting.");
    logDecision({
      decision: "skip",
      issueNumber: null,
      confidence: 0,
      reason: "No issues pass safety filters",
    });
    return;
  }

  // Check for existing PRs (to handle feedback)
  for (const issue of safeIssues) {
    const existingPR = await findExistingPR(issue.number, config.baseBranch);
    if (existingPR) {
      console.log(
        `Issue #${issue.number} has existing PR #${existingPR.number}`
      );

      if (config.dryRun) {
        console.log(
          `[DRY RUN] Would check for feedback on PR #${existingPR.number}`
        );
        continue;
      }

      const result = await handleExistingPR(issue, existingPR);
      if (result.action === "update") {
        // Run tests
        console.log("Running tests...");
        try {
          run(config.testCommand);
        } catch (err) {
          console.error("Tests failed. Reverting changes.");
          run("git checkout .");
          logDecision({
            decision: "skip",
            issueNumber: issue.number,
            confidence: 0.5,
            reason: "Tests failed after applying feedback",
          });
          return;
        }

        if (hasChanges()) {
          run("git add .");
          run(
            `git commit -m "Agent: address feedback on issue #${issue.number}"`
          );
          run(`git push origin agent/dev/issue-${issue.number}`);

          await addComment(
            result.prNumber,
            `🤖 Agent has addressed feedback:\n\n${result.implementation.summary}`
          );

          console.log("Pushed feedback changes.");
          logDecision({
            decision: "implement",
            issueNumber: issue.number,
            confidence: 0.8,
            reason: "Applied human feedback",
          });
          return;
        }
      }
    }
  }

  // Ask AI to pick an issue
  console.log("Asking AI to select an issue...");
  const decision = await pickIssue(safeIssues, config);

  logDecision(decision);

  // Check decision
  if (decision.decision !== "implement") {
    console.log(`Decision: skip - ${decision.reason}`);
    return;
  }

  if (decision.confidence < config.confidenceThreshold) {
    console.log(
      `Confidence ${decision.confidence} below threshold ${config.confidenceThreshold}. Skipping.`
    );
    return;
  }

  // Find the selected issue
  const issue = safeIssues.find((i) => i.number === decision.issueNumber);
  if (!issue) {
    console.error(`Issue #${decision.issueNumber} not found in candidates.`);
    return;
  }

  console.log(`\nSelected issue #${issue.number}: ${issue.title}`);

  // Dry run check
  if (config.dryRun) {
    console.log(`\n[DRY RUN] Would implement issue #${issue.number}`);
    console.log("Exiting without making changes.");
    return;
  }

  // Create branch
  const branch = `agent/dev/issue-${issue.number}`;
  console.log(`Creating branch: ${branch}`);

  run(`git checkout -b ${branch}`);

  // Gather context
  const context = await gatherContext(issue);

  // Generate implementation
  console.log("Generating implementation...");
  const implementation = await generateImplementation(issue, context, config);

  if (!implementation.files || implementation.files.length === 0) {
    console.log("AI generated no file changes. Skipping.");
    run("git checkout main");
    run(`git branch -D ${branch}`, { ignoreError: true });
    return;
  }

  console.log(`Generated ${implementation.files.length} file changes:`);
  for (const file of implementation.files) {
    console.log(`  - ${file.action}: ${file.path}`);
  }

  // Apply changes
  const results = applyFileChanges(implementation.files);
  console.log("\nApplied changes:", results);

  // Check for failures
  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.error("Some file operations failed:", failures);
  }

  // Run tests
  console.log("\nRunning tests...");
  try {
    run(config.testCommand);
  } catch (err) {
    console.error("Tests failed. Cleaning up.");
    run("git checkout .");
    run("git checkout main");
    run(`git branch -D ${branch}`, { ignoreError: true });

    await addComment(
      issue.number,
      `🤖 Agent attempted to implement this issue but tests failed.\n\nConfidence: ${decision.confidence}\nReason: ${decision.reason}`
    );

    return;
  }

  console.log("Tests passed!");

  // Commit and push
  if (!hasChanges()) {
    console.log("No changes to commit.");
    run("git checkout main");
    run(`git branch -D ${branch}`, { ignoreError: true });
    return;
  }

  run("git add .");
  run(`git commit -m "Agent: implement issue #${issue.number}

${implementation.summary}

Issue: #${issue.number}
Confidence: ${decision.confidence}"`);

  run(`git push origin ${branch}`);

  // Create PR
  console.log("Creating pull request...");
  const pr = await createPR({
    title: `Agent: ${issue.title}`,
    head: branch,
    base: config.baseBranch,
    body: `## Summary
${implementation.summary}

## Issue
Closes #${issue.number}

## Agent Decision
- **Confidence:** ${decision.confidence}
- **Reason:** ${decision.reason}

## Changes
${implementation.files.map((f) => `- \`${f.path}\` (${f.action})`).join("\n")}

---
🤖 *This PR was created automatically by the Dev Agent.*
*Human review required before merging.*`,
  });

  console.log(`\n✅ PR created: ${pr.html_url}`);
}

// Run the agent
main().catch((err) => {
  console.error("Agent failed with error:", err);
  process.exit(1);
});
