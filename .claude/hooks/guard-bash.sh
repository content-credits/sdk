#!/bin/bash
# PreToolUse guard for Bash commands — blocks destructive / policy-violating commands.
# Managed centrally in the workspace root .claude/hooks/; synced to repos by harness/sync.sh.
# Exit 2 = block (stderr is shown to the agent). Exit 0 = allow.

input=$(cat)
cmd=$(printf '%s' "$input" | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
  try{process.stdout.write((JSON.parse(d).tool_input||{}).command||"")}catch(e){}
});' 2>/dev/null)

[ -z "$cmd" ] && exit 0

block() { echo "BLOCKED by harness guard: $1" >&2; exit 2; }

case "$cmd" in
  *"push"*"--force"*|*"push"*" -f "*|*"push -f"*)
    block "force-push is not allowed. main is protected in every repo; if a branch truly needs rewriting, ask the user." ;;
esac

case "$cmd" in
  *"git reset --hard"*)
    block "git reset --hard discards work. Use git stash, or ask the user." ;;
  *"--no-verify"*)
    block "bypassing hooks/verification (--no-verify) is not allowed." ;;
  *"git checkout main"*"git push"*|*"git push origin main"*|*"git push -u origin main"*)
    block "direct push to main is not allowed — open a PR." ;;
esac

# rm -rf on suspicious targets (root-ish, home, whole workspace, or a repo root)
if printf '%s' "$cmd" | grep -qE 'rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s'; then
  if printf '%s' "$cmd" | grep -qE 'rm\s+-[a-zA-Z]+\s+("?/([^U]|$)|~|\$HOME|\.\s*$|\*\s*$)'; then
    block "rm -rf on a broad target. Delete specific paths only, or ask the user."
  fi
fi

# Never print or exfiltrate secrets (post-incident rule: 2026-06 secrets exfil)
if printf '%s' "$cmd" | grep -qE '(cat|less|head|tail|grep|cp|scp|curl.*-d|base64)[^|]*\.env(\s|$|")' \
   && ! printf '%s' "$cmd" | grep -q '\.env\.example'; then
  block "reading/copying .env files is not allowed (secrets). Use .env.example for variable names."
fi

# ── 2026-06 incident vectors (see SECURITY_INCIDENT_2026-06-23.md + ADR-0009) ──

# The backdoor was triggered by workflow_dispatch and lived in .github/workflows/.
case "$cmd" in
  *"gh workflow run"*|*"/dispatches"*)
    block "triggering GitHub Actions workflows requires explicit human approval (workflow_dispatch was the 2026-06 backdoor trigger)." ;;
  *"gh secret "*)
    block "managing GitHub Actions secrets is human-only (2026-06 incident)." ;;
esac
# Only writes INTO the workflows path count (plain reads/greps with stderr redirects are fine).
if printf '%s' "$cmd" | grep -qE '>+[[:space:]]*"?[^[:space:]"]*\.github/workflows' \
   || printf '%s' "$cmd" | grep -qE '(^|[|;&[:space:]])(mv|cp|rm|touch|tee|sed[[:space:]]+-i[^|;&]*)[[:space:]][^|;&]*\.github/workflows'; then
  block "modifying CI workflow files via shell is not allowed — use the Edit tool so the change is surfaced for human approval (2026-06 incident, ADR-0009)."
fi

# Exfil shapes: env/secrets encoded and shipped over the network (the exact backdoor pattern).
if printf '%s' "$cmd" | grep -qE '(base64|printenv|(^|[|;& ])env([ |;]|$)|xxd)' \
   && printf '%s' "$cmd" | grep -qE '(curl|wget|nc |ncat|/dev/tcp)'; then
  block "encoding data and sending it over the network matches the 2026-06 exfil backdoor pattern. If this is legitimate, the user must run it."
fi

# Piping remote content into a shell (supply-chain / dropper pattern).
if printf '%s' "$cmd" | grep -qE '(curl|wget)[^|]*\|\s*(ba|z|da)?sh'; then
  block "piping downloaded content into a shell is not allowed. Download, inspect, then ask the user."
fi

# Printing decrypted secrets from AWS.
case "$cmd" in
  *"--with-decryption"*)
    block "printing decrypted SSM parameters is not allowed (secrets in terminal output leak into logs/context). Ask the user to handle secret values." ;;
  *"secretsmanager get-secret-value"*)
    block "printing Secrets Manager values is not allowed. Ask the user to handle secret values." ;;
esac

# IAM persistence vectors (what an attacker with a foothold does; agents never need these).
if printf '%s' "$cmd" | grep -qE 'aws iam (create-access-key|create-user|create-login-profile|attach-[a-z]+-policy|put-[a-z]+-policy|add-user-to-group)'; then
  block "IAM credential/policy mutation is human-only (2026-06 incident hardening)."
fi

# Publishing is CI-only (public sdk package = supply-chain surface).
case "$cmd" in
  *"npm publish"*)
    block "npm publish is CI-only (GitHub Actions). Local publishes bypass provenance and are a supply-chain risk." ;;
esac

exit 0
