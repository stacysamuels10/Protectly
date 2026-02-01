/**
 * File system utilities for agent operations
 */
import fs from "fs";
import path from "path";

/**
 * Apply file changes to the local filesystem
 */
export function applyFileChanges(changes) {
  const results = [];

  for (const file of changes) {
    const filePath = file.path;

    try {
      switch (file.action) {
        case "create":
        case "modify": {
          // Ensure directory exists
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, file.content, "utf-8");
          results.push({ path: filePath, action: file.action, success: true });
          break;
        }
        case "delete": {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            results.push({ path: filePath, action: "delete", success: true });
          } else {
            results.push({
              path: filePath,
              action: "delete",
              success: false,
              error: "File not found",
            });
          }
          break;
        }
        default:
          results.push({
            path: filePath,
            action: file.action,
            success: false,
            error: "Unknown action",
          });
      }
    } catch (err) {
      results.push({
        path: filePath,
        action: file.action,
        success: false,
        error: err.message,
      });
    }
  }

  return results;
}

/**
 * Read a file's contents
 */
export function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    return null;
  }
}

/**
 * Check if a file exists
 */
export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Read multiple files and return their contents
 */
export function readFiles(filePaths) {
  const results = {};
  for (const filePath of filePaths) {
    const content = readFile(filePath);
    if (content !== null) {
      results[filePath] = content;
    }
  }
  return results;
}

/**
 * List files in a directory recursively
 */
export function listFilesRecursive(dir, extensions = []) {
  const results = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Skip node_modules, .git, etc.
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".next" ||
        entry.name === "dist"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        if (
          extensions.length === 0 ||
          extensions.some((ext) => entry.name.endsWith(ext))
        ) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Get file context for AI (truncated if too long)
 */
export function getFileContext(filePaths, maxCharsPerFile = 5000) {
  const context = [];

  for (const filePath of filePaths) {
    const content = readFile(filePath);
    if (content) {
      const truncated =
        content.length > maxCharsPerFile
          ? content.slice(0, maxCharsPerFile) + "\n... (truncated)"
          : content;

      context.push(`### ${filePath}\n\`\`\`\n${truncated}\n\`\`\``);
    }
  }

  return context.join("\n\n");
}
