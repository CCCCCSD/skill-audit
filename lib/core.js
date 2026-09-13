"use strict"

const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

const SKIP_DIRS = new Set(["node_modules", ".git"])

// Find every SKILL.md under root (dotted directories are visited so that
// Codex's .system built-ins are included; dotted files are ignored).
function walkSkillFiles(root, maxDepth = 8) {
  const out = []
  const visit = (dir, depth) => {
    if (depth > maxDepth) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        visit(full, depth + 1)
      } else if (entry.isFile() && entry.name.toLowerCase() === "skill.md") {
        out.push(full)
      }
    }
  }
  visit(root, 0)
  return out
}

// Minimal YAML frontmatter reader: leading --- block, key: value lines.
function parseFrontmatter(text) {
  const fm = {}
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!match) return fm
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+)\s*:\s*(.*)$/.exec(line)
    if (!kv) continue
    let value = kv[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    fm[kv[1].toLowerCase()] = value
  }
  return fm
}

function sha1Short(text) {
  return crypto.createHash("sha1").update(text, "utf8").digest("hex").slice(0, 12)
}

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4)
}

function dirSize(dir, maxDepth = 4) {
  let total = 0
  const visit = (current, depth) => {
    if (depth > maxDepth) return
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) visit(full, depth + 1)
      else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size
        } catch {}
      }
    }
  }
  visit(dir, 0)
  return total
}

// Attribute a skill to a plugin package when its path crosses a
// .../plugins/cache/<org>/<plugin>/<version>/skills/... layout.
function pluginOf(skillMdPath) {
  const segments = skillMdPath.split(/[\\/]/)
  const cacheIndex = segments.lastIndexOf("cache")
  if (cacheIndex > 0 && segments[cacheIndex + 1] && segments[cacheIndex + 3]) {
    const plugin = segments[cacheIndex + 2]
    const version = segments[cacheIndex + 3]
    return version ? `${plugin}@${version}` : plugin
  }
  return ""
}

function loadSkill(skillMdPath, root) {
  let text = ""
  try {
    text = fs.readFileSync(skillMdPath, "utf8")
  } catch {}
  const fm = parseFrontmatter(text)
  const dir = path.dirname(skillMdPath)
  let stat = null
  try {
    stat = fs.statSync(skillMdPath)
  } catch {}
  const rel = path.relative(root.path, dir)
  const layer =
    root.source === "codex" && (rel === ".system" || rel.startsWith(`.system${path.sep}`))
      ? "system"
      : root.layer
  const name = (fm.name || path.basename(dir)).trim()
  const description = (fm.description || "").trim()
  return {
    name,
    description,
    source: root.source,
    layer,
    plugin: pluginOf(skillMdPath),
    path: dir,
    bytes: stat ? stat.size : 0,
    dirBytes: dirSize(dir),
    mtime: stat ? stat.mtime.toISOString().slice(0, 10) : "",
    hash: sha1Short(text),
    tokens: estimateTokens(name) + estimateTokens(description),
  }
}

module.exports = { walkSkillFiles, parseFrontmatter, sha1Short, estimateTokens, dirSize, pluginOf, loadSkill }
