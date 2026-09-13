"use strict"

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

// Where skills live, per agent. Roots are only kept when they exist, so the
// tool works on machines with any subset of agents installed.
function discoverRoots(projectDir) {
  const home = os.homedir()
  const roots = []
  const add = (source, layer, p) => {
    try {
      if (fs.statSync(p).isDirectory()) roots.push({ source, layer, path: p })
    } catch {}
  }

  // Project-level skill directories (scan starts at --dir, default cwd).
  add("zcode", "project", path.join(projectDir, ".zcode", "skills"))
  add("zcode", "project", path.join(projectDir, ".agents", "skills"))
  add("claude", "project", path.join(projectDir, ".claude", "skills"))
  add("cursor", "project", path.join(projectDir, ".cursor", "skills"))

  // User-level skill directories.
  add("zcode", "user", path.join(home, ".zcode", "skills"))
  add("codex", "user", path.join(home, ".codex", "skills"))
  add("claude", "user", path.join(home, ".claude", "skills"))
  add("gemini", "user", path.join(home, ".gemini", "skills"))
  add("opencode", "user", path.join(home, ".config", "opencode", "skills"))

  // Plugin caches (walker picks up whatever SKILL.md trees live inside).
  add("zcode", "plugin", path.join(home, ".zcode", "cli", "plugins", "cache"))
  add("claude", "plugin", path.join(home, ".claude", "plugins"))

  return { home, roots }
}

module.exports = { discoverRoots }
