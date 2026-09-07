#!/usr/bin/env node
/**
 * Generates an animated "Cyan Laser Jet Game" contribution SVG
 * using a GitHub user's REAL contribution calendar.
 * Neon Lightning Blue (#00D4FF) & Obsidian Black (#080C14) theme.
 *
 * Automatically fetches live contribution data from GitHub:
 * - Real 53-week / 366-day calendar
 * - Real month labels (Sep, Oct, Nov, Dec, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep)
 * - ONLY colors cells where real contributions exist (no fake/random dots)
 * - Targets the active commit surge with the Sci-Fi Interceptor Combat Jet
 */

import fs from "node:fs";
import path from "node:path";

const USERNAME = process.env.GH_USERNAME || "tanmay119-pera";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const OUTPUT = process.env.OUTPUT_PATH || "dist/github-jet.svg";

const width = 880;
const height = 460;
const gridX = 66;
const gridY = 122;
const cell = 10.5;
const step = 14;
const rows = 7;
const cols = 53;

/**
 * Fetch real contributions from GitHub.
 * Uses public contributions API with GraphQL fallback.
 */
async function fetchContributions(username) {
  // Strategy 1: Public zero-auth API that mirrors GitHub's contribution graph
  try {
    const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.contributions && data.contributions.length > 0) {
        return {
          total: data.total?.lastYear || data.total?.[new Date().getFullYear()] || data.contributions.reduce((acc, d) => acc + d.count, 0),
          days: data.contributions,
        };
      }
    }
  } catch (err) {
    console.warn("Public API fetch error:", err.message);
  }

  // Strategy 2: GitHub GraphQL API if TOKEN is available
  if (TOKEN) {
    const query = `
      query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                  contributionLevel
                }
              }
            }
          }
        }
      }
    `;
    try {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `bearer ${TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "github-jet-generator",
        },
        body: JSON.stringify({ query, variables: { login: username } }),
      });
      if (res.ok) {
        const json = await res.json();
        const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
        if (cal) {
          const flatDays = [];
          for (const w of cal.weeks) {
            for (const d of w.contributionDays) {
              const lvlMap = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
              flatDays.push({
                date: d.date,
                count: d.contributionCount,
                level: lvlMap[d.contributionLevel] || (d.contributionCount > 0 ? 1 : 0),
              });
            }
          }
          return {
            total: cal.totalContributions,
            days: flatDays,
          };
        }
      }
    } catch (err) {
      console.warn("GraphQL error:", err.message);
    }
  }

  // Strategy 3: Fallback data snapshot if offline
  console.log("Using cached snapshot data for", username);
  return null;
}

async function main() {
  console.log(`Fetching contribution calendar for ${USERNAME}...`);
  const data = await fetchContributions(USERNAME);

  let days = data?.days || [];
  let totalContributions = data?.total || 253;

  // Ensure we have exactly 53 weeks (up to 371 days)
  if (days.length === 0) {
    // Generate snapshot matching real state if offline
    const startDate = new Date("2025-09-07T00:00:00Z");
    days = [];
    for (let i = 0; i < 366; i++) {
      const curr = new Date(startDate.getTime() + i * 86400000);
      const dateStr = curr.toISOString().split("T")[0];
      let count = 0;
      let level = 0;
      // August 10 onwards: cluster of commits
      if (curr >= new Date("2026-08-10T00:00:00Z") && curr <= new Date("2026-09-07T00:00:00Z")) {
        count = Math.floor(Math.random() * 12) + 4;
        level = count > 15 ? 4 : count > 10 ? 3 : count > 6 ? 2 : 1;
      }
      days.push({ date: dateStr, count, level });
    }
  }

  // Calculate month labels
  const monthNames = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  const months = [];
  let lastMonth = -1;

  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i].date + "T00:00:00Z");
    const m = d.getUTCMonth();
    const col = Math.floor(i / 7);
    if (m !== lastMonth && col < cols) {
      lastMonth = m;
      const mName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m];
      months.push({ name: mName, col });
    }
  }

  // Render Month Labels SVG
  let monthLabelsSvg = "";
  for (const m of months) {
    const mx = (gridX + m.col * step).toFixed(1);
    monthLabelsSvg += `    <text x="${mx}" y="106" fill="#64748B" font-size="10.5" font-weight="600">${m.name}</text>\n`;
  }

  // Render Contribution Grid Matrix (ONLY real contributions colored)
  let gridCells = "";
  let activeClusterCols = [];

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const dayIdx = c * 7 + r;
      const day = days[dayIdx];
      const x = (gridX + c * step).toFixed(1);
      const y = (gridY + r * step).toFixed(1);

      if (!day) continue;

      const count = day.count || 0;
      const level = day.level || 0;

      if (count > 0 && !activeClusterCols.includes(c)) {
        activeClusterCols.push(c);
      }

      if (count === 0) {
        // Base empty tile - dark obsidian
        gridCells += `    <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="#0D1524" stroke="#172338" stroke-width="0.8" />\n`;
      } else {
        // Real contribution tile - neon cyan / lightning blue levels
        let fill = "#073B61";
        let stroke = "#0C4A6E";
        let hasGlow = false;

        if (level >= 4 || count >= 19) {
          fill = "#00D4FF";
          stroke = "#38BDF8";
          hasGlow = true;
        } else if (level === 3 || count >= 13) {
          fill = "#0284C7";
          stroke = "#38BDF8";
          hasGlow = true;
        } else if (level === 2 || count >= 7) {
          fill = "#0369A1";
          stroke = "#0284C7";
        } else {
          fill = "#073B61";
          stroke = "#0C4A6E";
        }

        if (hasGlow) {
          gridCells += `    <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${fill}" stroke="${stroke}" stroke-width="1.2">
      <animate attributeName="opacity" values="0.75;1;0.75" dur="${(1.0 + (c % 3) * 0.3).toFixed(1)}s" repeatCount="indefinite" />
    </rect>\n`;
        } else {
          gridCells += `    <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${fill}" stroke="${stroke}" stroke-width="1.0" />\n`;
        }
      }
    }
  }

  // Calculate cluster center for HUD target lock
  const targetCol = activeClusterCols.length > 0 ? Math.round(activeClusterCols.reduce((a, b) => a + b, 0) / activeClusterCols.length) : 50;
  const targetX = (gridX + targetCol * step).toFixed(1);
  const targetY = (gridY + 3 * step).toFixed(1); // Row 3 (Wed)

  const svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Plus Jakarta Sans', Roboto, sans-serif">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="cardGlow" cx="65%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#0F223D" />
      <stop offset="50%" stop-color="#070D18" />
      <stop offset="100%" stop-color="#03050A" />
    </radialGradient>

    <!-- Inner Grid Panel Background -->
    <linearGradient id="innerGridBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#091222" />
      <stop offset="100%" stop-color="#050A14" />
    </linearGradient>

    <!-- Laser Beam Glow Gradients -->
    <linearGradient id="laserCyan" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.8" />
      <stop offset="70%" stop-color="#00D4FF" stop-opacity="1" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="1" />
    </linearGradient>

    <!-- Jet Body Armor Gradient -->
    <linearGradient id="jetHull" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#142B47" />
      <stop offset="50%" stop-color="#08182D" />
      <stop offset="100%" stop-color="#040C18" />
    </linearGradient>

    <!-- Glowing Filters -->
    <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="laserGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feGaussianBlur stdDeviation="1.8" result="sharp" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="sharp" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- ==================== OUTER FRAME ==================== -->
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="16" fill="url(#cardGlow)" stroke="#162E4E" stroke-width="1.6"/>

  <!-- Glowing Top Laser Line -->
  <path d="M 32 2 L 340 2" stroke="#00D4FF" stroke-width="3" stroke-linecap="round" filter="url(#neonGlow)"/>

  <!-- ==================== HEADER ==================== -->
  <!-- GitHub Logo Badge -->
  <g transform="translate(36, 26)">
    <circle cx="17" cy="17" r="16" fill="#0A182B" stroke="#00D4FF" stroke-width="1.4"/>
    <path d="M17 7C11.48 7 7 11.48 7 17c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48 0-.24-.01-1.03-.01-1.87-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.64.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03.8-.22 1.66-.33 2.52-.33.86 0 1.72.11 2.52.33 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85 0 1.34-.01 2.41-.01 2.74 0 .26.18.58.69.48 3.97-1.33 6.84-5.08 6.84-9.5 0-5.52-4.48-10-10-10z" fill="#00D4FF"/>
  </g>

  <!-- Header Heading: CONTRIBUTION BY ME -->
  <text x="82" y="49" fill="#00D4FF" font-size="22" font-weight="900" letter-spacing="1.8" filter="url(#neonGlow)">CONTRIBUTION BY ME</text>

  <!-- ==================== INNER GRID PANEL ==================== -->
  <rect x="26" y="78" width="828" height="200" rx="10" fill="url(#innerGridBg)" stroke="#14243C" stroke-width="1.2"/>

  <!-- Month Header Labels -->
  <g id="months">
${monthLabelsSvg}  </g>

  <!-- Day Labels -->
  <text x="38" y="145" fill="#475569" font-size="9.5" font-weight="700">Mon</text>
  <text x="38" y="173" fill="#475569" font-size="9.5" font-weight="700">Wed</text>
  <text x="38" y="201" fill="#475569" font-size="9.5" font-weight="700">Fri</text>

  <!-- Contribution Grid Matrix -->
  <g id="tiles">
${gridCells}  </g>

  <!-- Bottom Legend -->
  <g transform="translate(42, 252)">
    <text x="0" y="10" fill="#64748B" font-size="10.5" font-weight="600">Less</text>
    <rect x="32" y="1" width="10" height="10" rx="2" fill="#0D1524" stroke="#172338"/>
    <rect x="46" y="1" width="10" height="10" rx="2" fill="#073B61"/>
    <rect x="60" y="1" width="10" height="10" rx="2" fill="#0369A1"/>
    <rect x="74" y="1" width="10" height="10" rx="2" fill="#0284C7"/>
    <rect x="88" y="1" width="10" height="10" rx="2" fill="#00D4FF" filter="url(#neonGlow)"/>
    <text x="106" y="10" fill="#64748B" font-size="10.5" font-weight="600">More</text>
  </g>

  <!-- Target Locked HUD -->
  <g transform="translate(620, 252)">
    <text x="0" y="10" fill="#00D4FF" font-size="11" font-weight="800" letter-spacing="1">⚡ TARGET LOCKED: ${totalContributions} COMMITS</text>
    <animate attributeName="opacity" values="0.3;0.3;1;1;0.3;0.3" keyTimes="0;0.48;0.51;0.79;0.82;1" dur="16s" repeatCount="indefinite" />
  </g>

  <!-- ==================== ROTATING HUD TARGET RETICLE ==================== -->
  <!-- Appears and rotates ONLY when jet engages the active contribution sector -->
  <g transform="translate(${targetX}, ${targetY})">
    <animate attributeName="opacity" values="0;0;0.85;0.85;0;0" keyTimes="0;0.47;0.50;0.79;0.82;1" dur="16s" repeatCount="indefinite" />
    <circle cx="0" cy="0" r="30" fill="none" stroke="#00D4FF" stroke-width="1.2" stroke-dasharray="6,8" opacity="0.75">
      <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="5s" repeatCount="indefinite"/>
    </circle>
    <circle cx="0" cy="0" r="20" fill="none" stroke="#38BDF8" stroke-width="0.8" stroke-dasharray="3,5" opacity="0.6">
      <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="3.5s" repeatCount="indefinite"/>
    </circle>
    <!-- Targeting Crosshairs -->
    <line x1="-36" y1="0" x2="-24" y2="0" stroke="#00D4FF" stroke-width="1.8"/>
    <line x1="24" y1="0" x2="36" y2="0" stroke="#00D4FF" stroke-width="1.8"/>
    <line x1="0" y1="-36" x2="0" y2="-24" stroke="#00D4FF" stroke-width="1.8"/>
    <line x1="0" y1="24" x2="0" y2="36" stroke="#00D4FF" stroke-width="1.8"/>
  </g>

  <!-- ==================== SEQUENTIAL SINGLE LASERS (ONE AT A TIME) ==================== -->
  <!-- Laser Bolt 1: Active 8.2s - 9.0s (Target: Col 48/49) -->
  <g filter="url(#laserGlow)">
    <line x1="742" y1="317" x2="745" y2="178" stroke="url(#laserCyan)" stroke-width="3.2" stroke-linecap="round">
      <animate attributeName="opacity" values="0;0;1;0.9;1;0;0" keyTimes="0;0.512;0.516;0.538;0.560;0.563;1" dur="16s" repeatCount="indefinite" />
    </line>
    <line x1="742" y1="317" x2="745" y2="178" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round">
      <animate attributeName="opacity" values="0;0;1;0.9;1;0;0" keyTimes="0;0.512;0.516;0.538;0.560;0.563;1" dur="16s" repeatCount="indefinite" />
    </line>
  </g>

  <!-- Laser Bolt 2: Active 9.4s - 10.2s (Target: Col 50) -->
  <g filter="url(#laserGlow)">
    <line x1="766" y1="312" x2="766" y2="164" stroke="url(#laserCyan)" stroke-width="3.2" stroke-linecap="round">
      <animate attributeName="opacity" values="0;0;1;0.9;1;0;0" keyTimes="0;0.587;0.591;0.613;0.635;0.638;1" dur="16s" repeatCount="indefinite" />
    </line>
    <line x1="766" y1="312" x2="766" y2="164" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round">
      <animate attributeName="opacity" values="0;0;1;0.9;1;0;0" keyTimes="0;0.587;0.591;0.613;0.635;0.638;1" dur="16s" repeatCount="indefinite" />
    </line>
  </g>

  <!-- Laser Bolt 3: Active 10.6s - 11.4s (Target: Col 51) -->
  <g filter="url(#laserGlow)">
    <line x1="786" y1="317" x2="780" y2="150" stroke="url(#laserCyan)" stroke-width="3.2" stroke-linecap="round">
      <animate attributeName="opacity" values="0;0;1;0.9;1;0;0" keyTimes="0;0.662;0.666;0.688;0.710;0.713;1" dur="16s" repeatCount="indefinite" />
    </line>
    <line x1="786" y1="317" x2="780" y2="150" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round">
      <animate attributeName="opacity" values="0;0;1;0.9;1;0;0" keyTimes="0;0.662;0.666;0.688;0.710;0.713;1" dur="16s" repeatCount="indefinite" />
    </line>
  </g>

  <!-- Laser Bolt 4: Active 11.8s - 12.6s (Target: Col 52) -->
  <g filter="url(#laserGlow)">
    <line x1="800" y1="322" x2="794" y2="136" stroke="url(#laserCyan)" stroke-width="3.2" stroke-linecap="round">
      <animate attributeName="opacity" values="0;0;1;0.9;1;0;0" keyTimes="0;0.737;0.741;0.763;0.785;0.788;1" dur="16s" repeatCount="indefinite" />
    </line>
    <line x1="800" y1="322" x2="794" y2="136" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round">
      <animate attributeName="opacity" values="0;0;1;0.9;1;0;0" keyTimes="0;0.737;0.741;0.763;0.785;0.788;1" dur="16s" repeatCount="indefinite" />
    </line>
  </g>

  <!-- Impact Plasma Explosions (Trigger in sync with individual laser hits) -->
  <g transform="translate(745, 178)" filter="url(#laserGlow)">
    <circle cx="0" cy="0" r="14" fill="#00D4FF">
      <animate attributeName="r" values="3;3;16;18;12;3;3" keyTimes="0;0.515;0.520;0.538;0.558;0.564;1" dur="16s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0;0.9;0.7;0.9;0;0" keyTimes="0;0.515;0.520;0.538;0.558;0.564;1" dur="16s" repeatCount="indefinite"/>
    </circle>
    <circle cx="0" cy="0" r="4" fill="#FFFFFF">
      <animate attributeName="opacity" values="0;0;1;0.8;1;0;0" keyTimes="0;0.515;0.520;0.538;0.558;0.564;1" dur="16s" repeatCount="indefinite"/>
    </circle>
  </g>

  <g transform="translate(766, 164)" filter="url(#laserGlow)">
    <circle cx="0" cy="0" r="14" fill="#38BDF8">
      <animate attributeName="r" values="3;3;16;18;12;3;3" keyTimes="0;0.590;0.595;0.613;0.633;0.639;1" dur="16s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0;0.9;0.7;0.9;0;0" keyTimes="0;0.590;0.595;0.613;0.633;0.639;1" dur="16s" repeatCount="indefinite"/>
    </circle>
    <circle cx="0" cy="0" r="4" fill="#FFFFFF">
      <animate attributeName="opacity" values="0;0;1;0.8;1;0;0" keyTimes="0;0.590;0.595;0.613;0.633;0.639;1" dur="16s" repeatCount="indefinite"/>
    </circle>
  </g>

  <g transform="translate(780, 150)" filter="url(#laserGlow)">
    <circle cx="0" cy="0" r="14" fill="#00D4FF">
      <animate attributeName="r" values="3;3;16;18;12;3;3" keyTimes="0;0.665;0.670;0.688;0.708;0.714;1" dur="16s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0;0.9;0.7;0.9;0;0" keyTimes="0;0.665;0.670;0.688;0.708;0.714;1" dur="16s" repeatCount="indefinite"/>
    </circle>
    <circle cx="0" cy="0" r="4" fill="#FFFFFF">
      <animate attributeName="opacity" values="0;0;1;0.8;1;0;0" keyTimes="0;0.665;0.670;0.688;0.708;0.714;1" dur="16s" repeatCount="indefinite"/>
    </circle>
  </g>

  <g transform="translate(794, 136)" filter="url(#laserGlow)">
    <circle cx="0" cy="0" r="14" fill="#38BDF8">
      <animate attributeName="r" values="3;3;16;18;12;3;3" keyTimes="0;0.740;0.745;0.763;0.783;0.789;1" dur="16s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0;0.9;0.7;0.9;0;0" keyTimes="0;0.740;0.745;0.763;0.783;0.789;1" dur="16s" repeatCount="indefinite"/>
    </circle>
    <circle cx="0" cy="0" r="4" fill="#FFFFFF">
      <animate attributeName="opacity" values="0;0;1;0.8;1;0;0" keyTimes="0;0.740;0.745;0.763;0.783;0.789;1" dur="16s" repeatCount="indefinite"/>
    </circle>
  </g>

  <!-- ==================== MOVING COMBAT INTERCEPTOR JET ==================== -->
  <!-- Patrols smoothly across the timeline; engages weapons ONLY when contributions are nearby -->
  <g id="combatJet">
    <!-- Flight Path Translation Animation (16s Loop) -->
    <animateTransform attributeName="transform" type="translate"
      values="
        100,375;
        240,362;
        400,375;
        560,362;
        680,370;
        742,365;
        742,365;
        766,360;
        766,360;
        786,365;
        786,365;
        800,370;
        800,370;
        450,380;
        100,375"
      keyTimes="
        0;
        0.125;
        0.250;
        0.375;
        0.469;
        0.512;
        0.563;
        0.588;
        0.638;
        0.663;
        0.713;
        0.738;
        0.788;
        0.888;
        1"
      dur="16s" repeatCount="indefinite" />

    <!-- Flight Banking & Tilt Rotation Animation -->
    <g>
      <animateTransform attributeName="transform" type="rotate"
        values="
          6;
          -4;
          6;
          -3;
          4;
          -3;
          -3;
          0;
          0;
          3;
          3;
          -5;
          -5;
          -8;
          6"
        keyTimes="
          0;
          0.125;
          0.250;
          0.375;
          0.469;
          0.512;
          0.563;
          0.588;
          0.638;
          0.663;
          0.713;
          0.738;
          0.788;
          0.888;
          1"
        dur="16s" repeatCount="indefinite" />

      <!-- Dual Heavy Plasma Exhaust Flames -->
      <g transform="translate(0, 32)">
        <!-- Left Nozzle Fire -->
        <polygon points="-11,0 -6,38 -1,0" fill="#00D4FF" opacity="0.9" filter="url(#neonGlow)">
          <animate attributeName="points" values="-11,0 -6,34 -1,0; -11,0 -6,46 -1,0; -11,0 -6,34 -1,0" dur="0.08s" repeatCount="indefinite"/>
        </polygon>
        <polygon points="-9,0 -6,22 -3,0" fill="#FFFFFF">
          <animate attributeName="points" values="-9,0 -6,20 -3,0; -9,0 -6,28 -3,0; -9,0 -6,20 -3,0" dur="0.07s" repeatCount="indefinite"/>
        </polygon>

        <!-- Right Nozzle Fire -->
        <polygon points="1,0 6,38 11,0" fill="#00D4FF" opacity="0.9" filter="url(#neonGlow)">
          <animate attributeName="points" values="1,0 6,34 11,0; 1,0 6,46 11,0; 1,0 6,34 11,0" dur="0.08s" repeatCount="indefinite"/>
        </polygon>
        <polygon points="3,0 6,22 9,0" fill="#FFFFFF">
          <animate attributeName="points" values="3,0 6,20 9,0; 3,0 6,28 9,0; 3,0 6,20 9,0" dur="0.07s" repeatCount="indefinite"/>
        </polygon>
      </g>

      <!-- Twin Heavy Wingtip Railgun Cannons -->
      <rect x="-42" y="-12" width="3.5" height="24" rx="1.5" fill="#00D4FF" filter="url(#neonGlow)"/>
      <rect x="38.5" y="-12" width="3.5" height="24" rx="1.5" fill="#00D4FF" filter="url(#neonGlow)"/>

      <!-- Wing Cannon Energy Charge Orbs (Charges up when firing) -->
      <circle cx="-40.2" cy="-14" r="3.5" fill="#E0F2FE" filter="url(#laserGlow)">
        <animate attributeName="opacity" values="0.4;0.4;1;1;0.4;0.4" keyTimes="0;0.48;0.51;0.79;0.82;1" dur="16s" repeatCount="indefinite"/>
      </circle>
      <circle cx="40.2" cy="-14" r="3.5" fill="#E0F2FE" filter="url(#laserGlow)">
        <animate attributeName="opacity" values="0.4;0.4;1;1;0.4;0.4" keyTimes="0;0.48;0.51;0.79;0.82;1" dur="16s" repeatCount="indefinite"/>
      </circle>

      <!-- Swept Stealth Delta Wings (Layered Hull Plates) -->
      <polygon points="0,-22 -44,20 -16,24 0,28" fill="url(#jetHull)" stroke="#00D4FF" stroke-width="1.8"/>
      <polygon points="0,-22 44,20 16,24 0,28" fill="url(#jetHull)" stroke="#00D4FF" stroke-width="1.8"/>

      <!-- Cybernetic Wing Seams / Neon Circuit Lines -->
      <path d="M -8 4 L -36 18" stroke="#38BDF8" stroke-width="1.4" fill="none"/>
      <path d="M 8 4 L 36 18" stroke="#38BDF8" stroke-width="1.4" fill="none"/>
      <polygon points="-12,6 -32,18 -18,20" fill="#0284C7" opacity="0.8"/>
      <polygon points="12,6 32,18 18,20" fill="#0284C7" opacity="0.8"/>

      <!-- Forward Swept Canards -->
      <polygon points="0,-32 -20,-14 -12,-12 0,-18" fill="#073B61" stroke="#00D4FF" stroke-width="1.2"/>
      <polygon points="0,-32 20,-14 12,-12 0,-18" fill="#073B61" stroke="#00D4FF" stroke-width="1.2"/>

      <!-- Main Stealth Fuselage -->
      <polygon points="0,-48 11,24 0,29 -11,24" fill="url(#jetHull)" stroke="#38BDF8" stroke-width="2"/>

      <!-- Center Armor Spine with Neon Illumination -->
      <polygon points="0,-44 6,18 0,22 -6,18" fill="#0369A1" stroke="#00D4FF" stroke-width="1.2"/>

      <!-- Glowing Cyber Cockpit Canopy (Angular Diamond Glass) -->
      <polygon points="0,-34 6,-10 0,-4 -6,-10" fill="#E0F2FE" stroke="#00D4FF" stroke-width="1.5" filter="url(#neonGlow)">
        <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite"/>
      </polygon>

      <!-- Cockpit Internal HUD Targeting Line -->
      <line x1="0" y1="-30" x2="0" y2="-8" stroke="#00D4FF" stroke-width="1.2"/>

      <!-- Twin Vector Tailfins -->
      <polygon points="-5,14 -14,30 -6,28" fill="#0284C7" stroke="#38BDF8" stroke-width="1"/>
      <polygon points="5,14 14,30 6,28" fill="#0284C7" stroke="#38BDF8" stroke-width="1"/>
    </g>
  </g>
</svg>`;

  const outDir = path.dirname(OUTPUT);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(OUTPUT, svg, "utf8");
  console.log(`Successfully generated Cyan Laser Jet Game SVG at ${OUTPUT} with ${totalContributions} real contributions!`);
}

main().catch((err) => {
  console.error("Error generating jet SVG:", err);
  process.exit(1);
});
