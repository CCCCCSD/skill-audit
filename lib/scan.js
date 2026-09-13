"use strict"

const path = require("node:path")
const { discoverRoots } = require("./adapters")
const { walkSkillFiles, loadSkill } = require("./core")

function scanAll(projectDir) {
  const { home, roots } = discoverRoots(projectDir)
  const seen = new Set()
  const skills = []
  for (const root of roots) {
    for (const file of walkSkillFiles(root.path)) {
      const key = path.normalize(file).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      skills.push(loadSkill(file, root))
    }
  }
  skills.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name))

  const groups = (keyOf) => {
    const map = new Map()
    for (const skill of skills) {
      const key = keyOf(skill)
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(skill)
    }
    return [...map.entries()].filter(([, list]) => list.length > 1)
  }
  const duplicates = {
    byName: groups((s) => s.name.toLowerCase()),
    byHash: groups((s) => s.hash),
  }
  return { skills, duplicates, roots, home }
}

module.exports = { scanAll }
