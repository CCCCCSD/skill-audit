#!/usr/bin/env node
"use strict"

const fs = require("node:fs")
const path = require("node:path")
const { scanAll } = require("../lib/scan")
const { collectUsage } = require("../lib/usage")
const { renderTable, color } = require("../lib/render")

const VERSION = "0.1.0"

function parseArgs(argv) {
  const opts = { command: "scan", dir: process.cwd(), json: false, usageScan: true }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--dir") opts.dir = argv[++i]
    else if (arg === "--json") opts.json = true
    else if (arg === "--no-usage") opts.usageScan = false
    else if (arg === "--version" || arg === "-v") {
      process.stdout.write(`${VERSION}\n`)
      process.exit(0)
    } else if (arg === "--help" || arg === "-h") {
      opts.command = "help"
    } else rest.push(arg)
  }
  if (opts.command !== "help" && rest.length) opts.command = rest[0]
  if (opts.command === "help") {
    process.stdout.write(
      [
        `skill-audit v${VERSION} — local inventory & usage analysis for AI agent skills`,
        "",
        "Usage:",
        "  skill-audit [scan] [--dir <path>]   inventory + duplicates + usage (default)",
        "  skill-audit usage                   trigger counts from local session logs only",
        "",
        "Options:",
        "  --dir <path>   project directory to scan for project-level skills (default: cwd)",
        "  --json         machine-readable output on stdout",
        "  --no-usage     skip reading session logs (inventory only)",
        "",
        "Everything runs locally. No network, no API keys, no telemetry, zero dependencies.",
      ].join("\n") + "\n"
    )
    process.exit(0)
  }
  if (!fs.existsSync(opts.dir)) {
    process.stderr.write(`skill-audit: --dir does not exist: ${opts.dir}\n`)
    process.exit(2)
  }
  return opts
}

function humanSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${bytes}B`
}

function displayPath(p, home, projectDir) {
  const norm = p.split(path.sep).join("/")
  const homeNorm = home.split(path.sep).join("/")
  const projNorm = projectDir.split(path.sep).join("/")
  if (norm.toLowerCase().startsWith(homeNorm.toLowerCase() + "/")) {
    return "~/" + norm.slice(homeNorm.length + 1)
  }
  if (norm.toLowerCase().startsWith(projNorm.toLowerCase() + "/")) {
    return "./" + norm.slice(projNorm.length + 1)
  }
  return norm
}

function triggerInfo(skill, usage) {
  const key = skill.name.toLowerCase()
  if (!usage) return { text: "-", exact: 0, approx: 0 }
  const exact = usage.triggers.get(key) || 0
  const approx = usage.approximate.get(key) || 0
  if (exact > 0) return { text: String(exact), exact, approx }
  if (approx > 0) return { text: `≈${approx}`, exact, approx }
  return { text: "0", exact, approx }
}

function groupSummaryLine(label, groups) {
  if (!groups.length) return color.dim(`${label}: none`)
  const lines = groups.map(([key, list]) => {
    const where = list
      .map((s) => `${s.source}/${s.layer}`)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(", ")
    return `  "${key}" x${list.length} (${where})`
  })
  return [color.yellow(`${label}: ${groups.length}`), ...lines].join("\n")
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const { skills, duplicates, home } = scanAll(opts.dir)

  const usage = opts.usageScan ? await collectUsage(home, skills) : null

  if (opts.json) {
    const bySource = {}
    for (const skill of skills) bySource[skill.source] = (bySource[skill.source] || 0) + 1
    process.stdout.write(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          projectDir: opts.dir,
          home,
          summary: {
            total: skills.length,
            bySource,
            contextTaxTokens: skills.reduce((acc, s) => {
              acc[s.source] = (acc[s.source] || 0) + s.tokens
              return acc
            }, {}),
            zombies:
              usage === null
                ? null
                : skills
                    .filter((s) => triggerInfo(s, usage).exact === 0 && triggerInfo(s, usage).approx === 0)
                    .map((s) => s.name),
          },
          skills: skills.map((s) => {
            const info = triggerInfo(s, usage)
            return { ...s, triggers: info.exact, triggersApprox: info.approx, lastSeen: usage ? usage.lastSeen.get(s.name.toLowerCase()) || "" : "" }
          }),
          duplicates: {
            byName: duplicates.byName.map(([key, list]) => ({ key, paths: list.map((s) => s.path) })),
            byHash: duplicates.byHash.map(([key, list]) => ({ key, paths: list.map((s) => s.path) })),
          },
          usage: usage
            ? {
                sessionsScanned: usage.stats.sessions,
                logs: usage.stats.logs,
                triggers: Object.fromEntries(usage.triggers),
                lastSeen: Object.fromEntries(usage.lastSeen),
                approximateSources: ["codex"],
              }
            : null,
        },
        null,
        2
      )
    )
    process.stdout.write("\n")
    return
  }

  if (!skills.length) {
    process.stdout.write(
      `skill-audit: no SKILL.md files found under ${displayPath(opts.dir, home, opts.dir)} ` +
        "or known agent directories (~/.zcode, ~/.codex, ~/.claude, ...).\n"
    )
    return
  }

  const bySource = {}
  for (const skill of skills) bySource[skill.source] = (bySource[skill.source] || 0) + 1
  const sourceLine = Object.entries(bySource)
    .map(([source, count]) => `${source} ${count}`)
    .join(" · ")

  const rows = skills.map((s) => {
    const info = triggerInfo(s, usage)
    return [
      s.name,
      s.source,
      s.layer,
      humanSize(s.dirBytes),
      s.mtime,
      info.text,
      usage ? usage.lastSeen.get(s.name.toLowerCase()) || "-" : "-",
      displayPath(s.path, home, opts.dir),
      info.exact === 0 && info.approx === 0,
    ]
  })

  const table = renderTable(
    [
      { title: "SKILL", max: 26 },
      { title: "SOURCE", max: 8 },
      { title: "LAYER", max: 7 },
      { title: "SIZE", max: 8, align: "right" },
      { title: "MODIFIED", max: 10 },
      { title: "TRIGGERS", max: 8, align: "right" },
      { title: "LAST USED", max: 10 },
      { title: "PATH", max: 70 },
    ],
    rows.map((row) => row.slice(0, 8))
  )

  const coloredRows = table.split("\n")
  const header = coloredRows.slice(0, 2).join("\n")
  const body = coloredRows
    .slice(2)
    .map((line, i) => (rows[i][8] && usage ? color.red(line) : line))
    .join("\n")

  const contextTax = skills.reduce((acc, s) => {
    acc[s.source] = (acc[s.source] || 0) + s.tokens
    return acc
  }, {})
  const taxLine = Object.entries(contextTax)
    .map(([source, tokens]) => `${source} ≈${(tokens / 1000).toFixed(1)}k tokens`)
    .join(" · ")

  const lines = []
  lines.push(color.bold(`skill-audit v${VERSION}`) + color.dim(" — local skill inventory & usage"))
  lines.push(color.dim(`project: ${displayPath(opts.dir, home, opts.dir)}`))
  lines.push("")
  lines.push(`skills: ${skills.length} (${sourceLine})`)
  lines.push(color.dim(`context tax carried by EVERY request (name+description): ${taxLine}`))
  if (usage) {
    const logLine = Object.entries(usage.stats.logs)
      .map(([label, count]) => `${count} ${label}`)
      .join(" + ")
    lines.push(color.dim(`usage scan: ${usage.stats.sessions} session logs (${logLine}); codex counts are ≈ estimates`))
    const zombies = skills.filter((s) => triggerInfo(s, usage).exact === 0 && triggerInfo(s, usage).approx === 0)
    lines.push(
      zombies.length
        ? color.yellow(`zombie skills (0 triggers): ${zombies.length}/${skills.length} — ${zombies.slice(0, 8).map((s) => s.name).join(", ")}${zombies.length > 8 ? ", …" : ""}`)
        : color.green("zombie skills: none — every installed skill has been triggered")
    )
  }
  lines.push("")
  lines.push(header)
  lines.push(body)
  if (duplicates.byName.length || duplicates.byHash.length) {
    lines.push("")
    if (duplicates.byName.length) lines.push(groupSummaryLine("duplicate names", duplicates.byName))
    if (duplicates.byHash.length) lines.push(groupSummaryLine("identical content (hash)", duplicates.byHash))
  }
  process.stdout.write(lines.join("\n") + "\n")
}

main().catch((error) => {
  process.stderr.write(`skill-audit: ${error && error.stack ? error.stack : error}\n`)
  process.exit(1)
})
