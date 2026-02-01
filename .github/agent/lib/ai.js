/**
 * AI/LLM utilities for agent operations
 */
import OpenAI from "openai";
import fs from "fs";

let openai = null;

export function initAI(apiKey) {
  openai = new OpenAI({ apiKey });
}

/**
 * Ask the model to decide which issue to work on
 */
export async function pickIssue(issues, config) {
  const prompt = `You are a careful junior developer deciding which GitHub issue to implement.

Repository context:
${config.repoContext.join("\n- ")}

Available issues:
${issues
  .map(
    (i) => `
### Issue #${i.number}: ${i.title}
Labels: ${i.labels.map((l) => (typeof l === "string" ? l : l.name)).join(", ")}

${i.body || "(no description)"}
`
  )
  .join("\n---\n")}

Decision rules:
1. Pick AT MOST one issue
2. Skip any issue without clear acceptance criteria
3. Skip if the task seems too large or risky
4. Skip if there are ambiguities that require human clarification
5. Only pick an issue if you are confident you can implement it correctly

You MUST respond with valid JSON only, no other text:
{
  "decision": "implement" | "skip",
  "issueNumber": <number or null>,
  "confidence": <number between 0 and 1>,
  "reason": "<explanation>"
}`;

  const response = await openai.chat.completions.create({
    model: config.model || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate implementation for an issue
 * Returns an array of file changes
 */
export async function generateImplementation(issue, context, config) {
  const systemPrompt = `You are a careful, senior-level developer implementing a GitHub issue.

Repository context:
${config.repoContext.join("\n- ")}

Rules:
- Make MINIMAL changes - only what's needed for the issue
- Use TypeScript consistently
- Follow existing code patterns and conventions
- Do NOT touch Prisma schema unless explicitly required in the issue
- Do NOT refactor unrelated code
- Do NOT add features beyond what's specified
- Preserve existing file structure

You MUST respond with a JSON object containing file changes:
{
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "action": "create" | "modify" | "delete",
      "content": "full file content for create/modify, null for delete"
    }
  ],
  "summary": "Brief description of changes made",
  "testsAdded": true | false
}`;

  const userPrompt = `Implement the following issue:

## Issue #${issue.number}: ${issue.title}

${issue.body || "(no description)"}

${context.existingFiles ? `\nRelevant existing files:\n${context.existingFiles}` : ""}
${context.prFeedback ? `\nHuman feedback to address:\n${context.prFeedback}` : ""}`;

  const response = await openai.chat.completions.create({
    model: config.implementationModel || "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Apply feedback from PR comments
 */
export async function applyFeedback(issue, currentChanges, feedback, config) {
  const systemPrompt = `You are applying human feedback to an existing PR.

Rules:
- ONLY make changes that address the feedback
- Do NOT add new features
- Do NOT refactor beyond what's requested
- Keep changes minimal

Respond with the same JSON format as before:
{
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "action": "create" | "modify" | "delete",
      "content": "full file content"
    }
  ],
  "summary": "Brief description of changes made"
}`;

  const userPrompt = `Original issue #${issue.number}: ${issue.title}

Current implementation:
${JSON.stringify(currentChanges, null, 2)}

Human feedback to address:
${feedback.map((f) => `- ${f.user}: ${f.body}`).join("\n")}

Apply ONLY the requested changes.`;

  const response = await openai.chat.completions.create({
    model: config.implementationModel || "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * QA Agent: Review changes and suggest improvements
 */
export async function reviewChangesForQA(diff, changedFiles, config) {
  const systemPrompt = `You are a QA engineer reviewing code changes.

You do NOT:
- Add features
- Change architecture
- Refactor for style

You MAY:
- Add or improve tests (Vitest for unit, Playwright for E2E)
- Fix obvious bugs
- Improve validation or edge-case handling
- Add missing error handling

Repository context:
${config.repoContext.join("\n- ")}

Respond with JSON:
{
  "verdict": "pass" | "needs_changes" | "uncertain",
  "concerns": ["list of concerns if any"],
  "suggestedFixes": [
    {
      "path": "file path",
      "action": "create" | "modify",
      "content": "file content",
      "reason": "why this change"
    }
  ],
  "testsToAdd": [
    {
      "path": "test file path",
      "content": "test file content",
      "description": "what this tests"
    }
  ],
  "summary": "Overall QA summary"
}`;

  const userPrompt = `Review the following changes from qa branch compared to main:

Diff:
${diff}

Changed files:
${changedFiles.map((f) => `- ${f.filename} (${f.status})`).join("\n")}`;

  const response = await openai.chat.completions.create({
    model: config.implementationModel || "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Read relevant files for context
 */
export async function identifyRelevantFiles(issue, config) {
  const prompt = `Given this issue, list the files that are most likely to need changes.

Repository structure (Next.js + Prisma + Tailwind):
- src/app/ - Next.js app router pages and API routes
- src/components/ - React components
- src/lib/ - Utility functions
- prisma/ - Database schema
- e2e/ - Playwright tests

Issue #${issue.number}: ${issue.title}

${issue.body || ""}

Respond with JSON:
{
  "files": ["list", "of", "file", "paths"],
  "directories": ["directories", "to", "scan"]
}`;

  const response = await openai.chat.completions.create({
    model: config.model || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}
