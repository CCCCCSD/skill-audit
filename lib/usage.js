"use strict"

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const readline = require("node:readline")

// Evidence of a "trigger" in a session log line:
// 1. a tool_use block invoking the Skill tool  -> {"name":"Skill","input":{"skill":"..."}}
// 2. a slash command expansion                 -> <command-name>/foo</command-name>
const normalize = (raw) => String(raw || "").trim().replace(/^\//, "").toLowerCase()

async function countSkillInvocations(file) {
  const counts = new Map()
  const hit = (raw) => {
    const key = normalize(raw)
    if (key) counts.set(key, (counts.get(key) || 0) + 1)
  }
  const walk = (node, seen, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 40 || seen.has(node)) return
    seen.add(node)
    if (
      node.type === "tool_use" &&
      typeof node.name === "string" &&
      node.name.toLowerCase() === "skill" &&
      node.input &&
      typeof node.input.skill === "string"
    ) {
      hit(node.input.skill)
    }
    for (const key of Object.keys(node)) walk(node[key], seen, depth + 1)
  }
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    if (!line.trim()) continue
    for (const match of line.matchAll(/<command-name>([^<]+)<\/command-name>/g)) hit(match[1])
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    walk(obj, new Set())
  }
  return counts
}

function listJsonl(dir, recursive) {
  const out = []
  const visit = (current, depth) => {
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory() && recursive && depth < 6 && entry.name !== "node_modules") {
        visit(full, depth + 1)
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        out.push(full)
      }
    }
  }
  visit(dir, 0)
  return out
}

async function mergeExactLogs(triggers, lastSeen, dir, recursive, stats, label) {
  const files = listJsonl(dir, recursive)
  for (const file of files) {
    stats.sessions += 1
    stats.logs[label] = (stats.logs[label] || 0) + 1
    let mtime = ""
    try {
      mtime = fs.statSync(file).mtime.toISOString().slice(0, 10)
    } catch {}
    const counts = await countSkillInvocations(file)
    for (const [name, count] of counts) {
      triggers.set(name, (triggers.get(name) || 0) + count)
      if (mtime && (!lastSeen.get(name) || mtime > lastSeen.get(name))) lastSeen.set(name, mtime)
    }
  }
}

// Codex rollout logs list every installed skill (with its SKILL.md path) in
// each session's system prompt, so one mention per session is baseline noise.
// Mentions beyond that baseline estimate an actual load; flagged approximate.
async function codexEstimates(home, skills, stats) {
  const estimates = new Map()
  const codexNames = skills.filter((s) => s.source === "codex").map((s) => s.name)
  if (!codexNames.length) return estimates
  const files = listJsonl(path.join(home, ".codex", "sessions"), true)
  const perName = new Map(codexNames.map((n) => [n.toLowerCase(), { mentions: 0, sessions: 0 }]))
  for (const file of files) {
    stats.sessions += 1
    stats.logs.codex = (stats.logs.codex || 0) + 1
    let text = ""
    try {
      text = fs.readFileSync(file, "utf8")
    } catch {
      continue
    }
    for (const name of codexNames) {
      const key = name.toLowerCase()
      const info = perName.get(key)
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const matches = text.match(new RegExp(`skills[\\\\/]+${escaped}[\\\\/]+SKILL\\.md`, "gi"))
      if (!matches) continue
      info.mentions += matches.length
      info.sessions += 1
    }
  }
  for (const [key, info] of perName) {
    const extra = Math.max(0, info.mentions - info.sessions)
    if (extra > 0) estimates.set(key, extra)
  }
  return estimates
}

async function collectUsage(home, skills) {
  const stats = { sessions: 0, logs: {} }
  const triggers = new Map()
  const lastSeen = new Map()
  await mergeExactLogs(triggers, lastSeen, path.join(home, ".zcode", "cli", "rollout"), false, stats, "zcode")
  await mergeExactLogs(triggers, lastSeen, path.join(home, ".claude", "projects"), true, stats, "claude")
  const approximate = await codexEstimates(home, skills, stats)
  return { triggers, lastSeen, approximate, stats }
}

module.exports = { collectUsage }
