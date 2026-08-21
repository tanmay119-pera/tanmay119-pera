#!/usr/bin/env node
/**
 * Generates an animated "rocket/jet over contribution grid" SVG using a GitHub
 * user's REAL contribution calendar.
 * Customized with Cyberpunk Purple & Electric Blue theme!
 */

import fs from "node:fs";
import path from "node:path";

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const OUTPUT = process.env.OUTPUT_PATH || "dist/github-jet.svg";
const COLS = 34;
const ROWS = 7;
const CELL = 11;
const STEP = 14;
const GRID_X = 20;
const GRID_Y = 15;
const WIDTH = 513;
const HEIGHT = 170;
const JET_X_START = 35;
const JET_X_END = 478;
const LOOP_DUR = 16;
const MAX_TARGETS = 18;

// 🎨 Purple & Electric Cyan Cyberpunk Palette
const FLASH_COLOR = "#FF10F0"; 
const BULLET_COLOR = "#00D4FF"; 
const BLAST_COLOR = "#C850C0"; 
const PAD_Y = 132;

if (!USERNAME) {
  console.error("Missing GH_USERNAME env var");
  process.exit(1);
}
if (!TOKEN) {
  console.error("Missing GH_TOKEN / GITHUB_TOKEN env var");
  process.exit(1);
}

const QUERY = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
              color
            }
          }
        }
      }
    }
  }
`;

async function fetchWeeks() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

function buildCells(weeks) {
  const recent = weeks.slice(-COLS);
  const padCount = COLS - recent.length;
  const padded = Array.from({ length: padCount }, () => ({
    contributionDays: Array.from({ length: ROWS }, () => ({
      contributionCount: 0,
      color: "#161b22",
      date: null,
    })),
  })).concat(recent);

  const cells = [];
  padded.forEach((week, col) => {
    week.contributionDays.forEach((day, row) => {
      let c = "#10081d";
      if (day.contributionCount > 0) {
        if (day.contributionCount >= 8) c = "#FF10F0";
        else if (day.contributionCount >= 4) c = "#C850C0";
        else if (day.contributionCount >= 2) c = "#7B2CBF";
        else c = "#4A148C";
      }

      cells.push({
        col,
        row,
        x: GRID_X + col * STEP,
        y: GRID_Y + row * STEP,
        color: c,
        count: day.contributionCount || 0,
        date: day.date,
      });
    });
  });
  return cells;
}

function pickTargets(cells) {
  return [...cells]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TARGETS)
    .sort((a, b) => a.col - b.col || a.row - b.row);
}

function keyTimeForCol(col, direction) {
  const span = 0.46;
  const t = 0.02 + (col / (COLS - 1)) * span;
  return direction === "forward" ? t : 1 - t;
}

function fmt(n) {
  return Number(n.toFixed(4));
}

function buildGrid(cells, targets) {
  const targetKey = new Set(targets.map((t) => `${t.col}-${t.row}`));
  let svg = "";
  for (const c of cells) {
    const isTarget = targetKey.has(`${c.col}-${c.row}`);
    if (!isTarget) {
      svg += `<rect x="${c.x.toFixed(2)}" y="${c.y.toFixed(2)}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${c.color}" stroke="${c.count > 0 ? '#5a189a' : '#1d122b'}" stroke-width="0.5"/>\n`;
      continue;
    }
    const tFwd = keyTimeForCol(c.col, "forward");
    const tBack = keyTimeForCol(c.col, "backward");
    const [t1, t2] = [Math.min(tFwd, tBack), Math.max(tFwd, tBack)];
    const dur = 0.008;
    svg += `<rect x="${c.x.toFixed(2)}" y="${c.y.toFixed(2)}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${c.color}">` +
      `<animate attributeName="fill" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
      `keyTimes="0;${fmt(t1)};${fmt(t1 + dur)};${fmt(t2)};${fmt(t2 + dur)};1" ` +
      `values="${c.color};${c.color};${FLASH_COLOR};${c.color};${FLASH_COLOR};${c.color}"/>` +
      `<animate attributeName="stroke" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
      `keyTimes="0;${fmt(t1)};${fmt(t1 + dur)};${fmt(t2)};${fmt(t2 + dur)};1" ` +
      `values="#4A148C;#4A148C;#00D4FF;#4A148C;#00D4FF;#4A148C"/>` +
      `</rect>\n`;
  }
  return svg;
}

function buildBulletsAndBlasts(targets) {
  let bullets = "";
  let blasts = "";
  const dur = 0.008;

  for (const dir of ["forward", "backward"]) {
    const ordered = dir === "forward" ? targets : [...targets].reverse();
    for (const c of ordered) {
      const t = keyTimeForCol(c.col, dir);
      const rise = t - dur * 3;
      const arrive = t;
      const fadeEnd = t + dur;
      const cx = fmt(c.x + CELL / 2);
      const targetY = fmt(c.y + CELL / 2);

      bullets += `<circle cx="${cx}" cy="${PAD_Y}" r="2.5" fill="${BULLET_COLOR}">` +
        `<animate attributeName="cy" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
        `keyTimes="0;${fmt(rise)};${fmt(arrive)};1" values="${PAD_Y};${PAD_Y};${targetY};${targetY}"/>` +
        `<animate attributeName="opacity" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
        `keyTimes="0;${fmt(rise)};${fmt(arrive)};${fmt(fadeEnd)};1" values="0;1;1;0;0"/>` +
        `</circle>\n`;

      blasts += `<circle cx="${cx}" cy="${targetY}" r="0" fill="none" stroke="${BLAST_COLOR}" stroke-width="2.2" opacity="0">` +
        `<animate attributeName="r" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
        `keyTimes="0;${fmt(arrive)};${fmt(arrive + dur * 3)};1" values="0;1;11;11"/>` +
        `<animate attributeName="opacity" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
        `keyTimes="0;${fmt(arrive)};${fmt(arrive + dur * 3)};1" values="0;1;1;0"/>` +
        `</circle>\n`;
    }
  }
  return { bullets, blasts };
}

function buildStars() {
  const pts = [
    [8, 20, 1.2], [8, 60, 1.6], [8, 100, 2.0],
    [505, 25, 1.2], [505, 70, 1.6], [505, 110, 2.0],
    [30, 164, 1.2], [483, 164, 1.6], [250, 8, 1.4], [120, 160, 1.8], [380, 160, 1.5]
  ];
  return pts.map(([x, y, dur]) =>
    `<circle cx="${x}" cy="${y}" r="1.2" fill="#C850C0"><animate attributeName="opacity" values="0.2;1;0.2" dur="${dur}s" repeatCount="indefinite"/></circle>`
  ).join("\n");
}

function buildRocket() {
  return `<g id="rocket">
  <g transform="translate(0,0)">
    <polygon points="0,-18 7,6 4,4 -4,4 -7,6" fill="#C850C0" stroke="#00D4FF" stroke-width="1.2"/>
    <polygon points="-7,6 -13,13 -4,7" fill="#7B2CBF"/>
    <polygon points="7,6 13,13 4,7" fill="#7B2CBF"/>
    <circle cx="0" cy="-6" r="2.4" fill="#00D4FF"/>
    <polygon points="-3,7 3,7 0,17" fill="#FF10F0">
      <animate attributeName="opacity" values="0.5;1;0.6;1" dur="0.15s" repeatCount="indefinite"/>
    </polygon>
    <polygon points="-1.5,7 1.5,7 0,12" fill="#00D4FF">
      <animate attributeName="opacity" values="0.8;1;0.4;1" dur="0.12s" repeatCount="indefinite"/>
    </polygon>
  </g>
  <animateTransform attributeName="transform" attributeType="XML" type="translate"
    dur="${LOOP_DUR}s" repeatCount="indefinite"
    keyTimes="0;0.5;1"
    values="${JET_X_START}.00,140.00;${JET_X_END}.00,140.00;${JET_X_START}.00,140.00"/>
</g>`;
}

function buildSvg(weeks) {
  const cells = buildCells(weeks);
  const targets = pickTargets(cells);
  const { bullets, blasts } = buildBulletsAndBlasts(targets);

  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <radialGradient id="bgGlow" cx="50%" cy="50%" r="60%">
    <stop offset="0%" stop-color="#140624" />
    <stop offset="100%" stop-color="#050508" />
  </radialGradient>
</defs>
<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#bgGlow)" rx="6"/>
${buildStars()}
<g id="grid">
${buildGrid(cells, targets)}</g>
<g id="bullets">
${bullets}</g>
<g id="blasts">
${blasts}</g>
${buildRocket()}
</svg>`;
}

async function main() {
  console.log(`Fetching contributions for ${USERNAME}...`);
  const weeks = await fetchWeeks();
  const svg = buildSvg(weeks);
  const outPath = path.resolve(OUTPUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
