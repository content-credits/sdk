#!/usr/bin/env node
// PreToolUse guard for Edit/Write — two jobs, both born from the 2026-06 incident
// (compromised org member planted a secrets-exfil GitHub Actions workflow; see
// archive/security-incident-2026-06/ at the workspace root, and ADR-0009):
//   1. Any edit under .github/workflows/ requires explicit human approval ("ask").
//   2. Secret-looking content (keys, tokens, creds-in-URLs) and known exfil IoCs
//      are hard-blocked from being written into files.
// Managed centrally in the workspace root .claude/hooks/; synced by harness/sync.sh.

let d = "";
process.stdin.on("data", c => d += c).on("end", () => {
  let inp = {};
  try { inp = JSON.parse(d).tool_input || {}; } catch (e) { process.exit(0); }
  const path = inp.file_path || "";
  const content = [inp.content, inp.new_string].filter(Boolean).join("\n");

  // 1. Workflow files → human must approve (the 2026-06 backdoor was a workflow file)
  if (/\.github\/workflows\//.test(path)) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason:
          "Edit under .github/workflows/ — CI workflow changes require explicit human approval " +
          "(the 2026-06 incident was a malicious workflow exfiltrating Actions secrets; see ADR-0009)."
      }
    }));
    process.exit(0);
  }

  // 2. Secret patterns and exfil IoCs must never be written into files
  const patterns = [
    [/-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY/, "private key material"],
    [/AKIA[0-9A-Z]{16}/, "AWS access key id"],
    [/(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/, "GitHub token"],
    [/github_pat_[A-Za-z0-9_]{20,}/, "GitHub fine-grained PAT"],
    [/xox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
    [/npm_[A-Za-z0-9]{30,}/, "npm token"],
    [/AIza[0-9A-Za-z_-]{35}/, "Google API key"],
    [/sk_live_[A-Za-z0-9]{16,}/, "live secret key (sk_live_)"],
    [/mongodb(\+srv)?:\/\/[^/\s:"']+:[^@\s"']+@/, "MongoDB connection string with embedded credentials"],
    [/toJSON\s*\(\s*secrets\s*\)/, "GitHub Actions secrets dump via toJSON — exact IoC of the 2026-06 backdoor"],
  ];
  for (const [re, what] of patterns) {
    if (re.test(content)) {
      console.error(
        `BLOCKED by harness secret guard: content matches ${what}. ` +
        `Secrets never go in code, commits, or logs (2026-06 incident, ADR-0009). ` +
        `Use env vars via SSM/.env (names only in .env.example). If this is a deliberate ` +
        `fake/fixture, the user must add it manually.`
      );
      process.exit(2);
    }
  }
  process.exit(0);
});
