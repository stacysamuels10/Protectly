/**
 * GitHub API utilities for agent operations
 */
import { Octokit } from "@octokit/rest";

let octokit = null;
let owner = null;
let repo = null;

export function initGitHub(token, repository) {
  octokit = new Octokit({ auth: token });
  [owner, repo] = repository.split("/");
}

export function getOwnerRepo() {
  return { owner, repo };
}

/**
 * Get the first open milestone (assumed to be current)
 */
export async function getActiveMilestone() {
  const { data } = await octokit.issues.listMilestones({
    owner,
    repo,
    state: "open",
    sort: "due_on",
    direction: "asc",
  });
  return data[0] || null;
}

/**
 * Get issues that are candidates for agent work
 */
export async function getCandidateIssues(milestoneNumber) {
  const { data } = await octokit.issues.listForRepo({
    owner,
    repo,
    milestone: milestoneNumber,
    state: "open",
    labels: "agent-ok",
  });

  // Filter out PRs (GitHub API returns PRs as issues too)
  return data.filter((issue) => !issue.pull_request);
}

/**
 * Check if issue has any of the skip labels
 */
export function hasSkipLabel(issue, skipLabels) {
  const issueLabels = issue.labels.map((l) =>
    typeof l === "string" ? l : l.name
  );
  return skipLabels.some((skip) => issueLabels.includes(skip));
}

/**
 * Find an existing open PR for an issue created by the agent
 */
export async function findExistingPR(issueNumber, baseBranch) {
  const branchName = `agent/dev/issue-${issueNumber}`;
  
  const { data: pulls } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    head: `${owner}:${branchName}`,
    base: baseBranch,
  });

  return pulls[0] || null;
}

/**
 * Get comments on a PR (for feedback incorporation)
 */
export async function getPRComments(prNumber) {
  const [reviewComments, issueComments] = await Promise.all([
    octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
    }),
    octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    }),
  ]);

  return {
    reviewComments: reviewComments.data,
    issueComments: issueComments.data,
  };
}

/**
 * Get the diff for a PR
 */
export async function getPRDiff(prNumber) {
  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: "diff" },
  });
  return data;
}

/**
 * Create a new pull request
 */
export async function createPR({ title, head, base, body }) {
  const { data } = await octokit.pulls.create({
    owner,
    repo,
    title,
    head,
    base,
    body,
  });
  return data;
}

/**
 * Add a comment to an issue or PR
 */
export async function addComment(issueNumber, body) {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

/**
 * Get diff between two branches
 */
export async function compareBranches(base, head) {
  const { data } = await octokit.repos.compareCommits({
    owner,
    repo,
    base,
    head,
  });
  return data;
}

/**
 * Get file content from repo
 */
export async function getFileContent(path, ref = "HEAD") {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });
    
    if (data.type === "file" && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * List files in a directory
 */
export async function listFiles(path, ref = "HEAD") {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });
    
    if (Array.isArray(data)) {
      return data.map((f) => ({ name: f.name, path: f.path, type: f.type }));
    }
    return [];
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}
