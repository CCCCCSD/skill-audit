"use strict"

function renderTable(cols, rows) {
  const widths = cols.map((col, i) => {
    let width = col.title.length
    for (const row of rows) width = Math.max(width, String(row[i] ?? "").length)
    return Math.min(width, col.max || 60)
  })
  const format = (cells) =>
    cells
      .map((cell, i) => {
        let text = String(cell ?? "")
        if (text.length > widths[i]) text = text.slice(0, widths[i] - 1) + "…"
        const pad = " ".repeat(widths[i] - text.length)
        return cols[i].align === "right" ? pad + text : text + pad
      })
      .join("  ")
  const head = format(cols.map((col) => col.title))
  const sep = widths.map((width) => "-".repeat(width)).join("  ")
  return [head, sep, ...rows.map((row) => format(row))].join("\n")
}

const tty = process.stdout.isTTY
const color = {
  bold: (s) => (tty ? `\x1b[1m${s}\x1b[0m` : s),
  yellow: (s) => (tty ? `\x1b[33m${s}\x1b[39m` : s),
  red: (s) => (tty ? `\x1b[31m${s}\x1b[39m` : s),
  green: (s) => (tty ? `\x1b[32m${s}\x1b[39m` : s),
  dim: (s) => (tty ? `\x1b[2m${s}\x1b[22m` : s),
}

module.exports = { renderTable, color }
