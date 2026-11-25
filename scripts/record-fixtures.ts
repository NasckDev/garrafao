/**
 * Grava respostas reais da ESPN em tests/fixtures/espn, reduzidas aos campos que os normalizadores leem
 * (as respostas cruas chegam a 2,5 MB por mês de calendário). O manifesto liga cada URL de origem ao arquivo,
 * e é ele que o `fetch` de teste usa para responder exatamente como a origem respondeu.
 *
 * Uso: npm run fixtures:record -- [--live YYYYMMDD EVENTO]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { arr, isObj, obj } from "../server/json.js";
import { normalizeSeason, seasonMonths } from "../server/normalize/season.js";
import { originUrl } from "../server/origin.js";
import { FEATURED_IDS } from "../src/config/featured.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "tests", "fixtures", "espn");
const MANIFEST = join(ROOT, "tests", "fixtures", "manifest.json");

type Pruner = (raw: unknown) => unknown;

function pick(value: unknown, keys: string[]): Record<string, unknown> {
  const source = obj(value);
  const out: Record<string, unknown> = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

const TEAM_KEYS = ["id", "abbreviation", "displayName", "shortDisplayName", "name", "location", "color", "alternateColor", "logo"];
const team = (raw: unknown) => {
  const out = pick(raw, TEAM_KEYS);
  const logos = arr(obj(raw).logos).slice(0, 1);
  if (logos.length) out.logos = logos.map((logo) => pick(logo, ["href", "rel"]));
  return out;
};

const status = (raw: unknown) => ({
  ...pick(raw, ["period", "displayClock"]),
  type: pick(obj(raw).type, ["name", "state", "completed", "detail", "shortDetail"]),
});

const competition = (raw: unknown, withStatus: boolean) => {
  const out = pick(raw, ["id", "date", "timeValid", "type", "notes"]);
  if (withStatus && isObj(obj(raw).status)) out.status = status(obj(raw).status);
  const venue = obj(obj(raw).venue);
  if (venue.fullName) out.venue = { fullName: venue.fullName };
  out.competitors = arr(obj(raw).competitors).map((c) => ({
    ...pick(c, ["id", "homeAway", "winner", "score"]),
    linescores: arr(obj(c).linescores).map((line) => pick(line, ["value", "displayValue"])),
    records: arr(obj(c).records ?? obj(c).record)
      .filter((record) => ["total", "overall"].includes(String(obj(record).type ?? obj(record).name)))
      .map((record) => pick(record, ["type", "name", "summary"])),
    team: team(obj(c).team),
  }));
  return out;
};

const event = (raw: unknown) => {
  const source = obj(raw);
  const out = pick(raw, ["id", "date", "name", "timeValid"]);
  if (isObj(source.season)) out.season = pick(source.season, ["year", "type", "slug"]);
  if (isObj(source.status)) out.status = status(source.status);
  out.competitions = arr(source.competitions).slice(0, 1).map((c) => competition(c, !isObj(source.status)));
  return out;
};

const pruners: Record<string, Pruner> = {
  scoreboard: (raw) => ({ events: arr(obj(raw).events).map(event) }),
  summary: (raw) => ({
    header: event(obj(raw).header),
    leaders: arr(obj(raw).leaders).map((entry) => ({
      team: pick(obj(entry).team, ["id", "abbreviation", "displayName"]),
      leaders: arr(obj(entry).leaders).map((category) => ({
        ...pick(category, ["name", "displayName"]),
        leaders: arr(obj(category).leaders)
          .slice(0, 1)
          .map((leader) => ({
            ...pick(leader, ["displayValue", "value"]),
            athlete: pick(obj(leader).athlete, ["id", "displayName", "fullName", "shortName", "headshot"]),
          })),
      })),
    })),
    gameInfo: { venue: pick(obj(obj(raw).gameInfo).venue, ["fullName"]), attendance: obj(obj(raw).gameInfo).attendance },
  }),
  standings: (raw) => ({
    children: arr(obj(raw).children).map((child) => ({
      ...pick(child, ["name", "abbreviation"]),
      standings: {
        ...pick(obj(child).standings, ["seasonDisplayName"]),
        entries: arr(obj(obj(child).standings).entries).map((entry) => ({
          team: team(obj(entry).team),
          stats: arr(obj(entry).stats).map((stat) => pick(stat, ["name", "type", "value", "displayValue", "summary"])),
        })),
      },
    })),
  }),
  news: (raw) => ({
    articles: arr(obj(raw).articles).map((article) => ({
      ...pick(article, ["id", "type", "headline", "description", "published", "byline", "links"]),
      images: arr(obj(article).images).slice(0, 1).map((image) => pick(image, ["url", "alt", "caption", "name"])),
    })),
  }),
  teams: (raw) => ({
    sports: [{ leagues: [{ teams: arr(obj(arr(obj(arr(obj(raw).sports)[0]).leagues)[0]).teams).map((entry) => ({ team: team(obj(entry).team) })) }] }],
  }),
  roster: (raw) => ({
    team: team(obj(raw).team),
    athletes: arr(obj(raw).athletes).map((athlete) => pick(athlete, ["id", "displayName", "fullName", "jersey", "position", "headshot"])),
  }),
  athlete: (raw) => {
    const athlete = obj(obj(raw).athlete);
    return {
      athlete: {
        ...pick(athlete, [
          "id", "firstName", "lastName", "displayName", "fullName", "jersey", "position", "headshot", "height", "weight",
          "displayHeight", "displayWeight", "age", "displayBirthPlace", "college", "displayDraft", "displayExperience", "active", "statsSummary",
        ]),
        team: isObj(athlete.team) ? team(athlete.team) : undefined,
      },
    };
  },
  overview: (raw) => ({ statistics: obj(raw).statistics }),
  search: (raw) => ({
    items: arr(obj(raw).items).map((item) => ({
      ...pick(item, ["id", "displayName", "type", "league", "defaultLeagueSlug", "position", "headshot", "jersey"]),
      teamRelationships: arr(obj(item).teamRelationships).slice(0, 1).map((rel) => ({ core: pick(obj(rel).core, ["id", "abbreviation", "displayName"]) })),
    })),
  }),
  draftSite: (raw) => ({
    ...pick(raw, ["year", "displayName", "shortDisplayName", "rounds", "status", "positions"]),
    teams: arr(obj(raw).teams).map(team),
    picks: arr(obj(raw).picks).map((p) => ({
      ...pick(p, ["overall", "pick", "round", "status", "teamId", "traded", "tradeNote"]),
      athlete: pick(obj(p).athlete, ["displayName", "position", "team", "headshot", "leagueAffiliation"]),
    })),
  }),
  draftCore: (raw) => pick(raw, ["year", "numberOfRounds", "displayName", "shortDisplayName", "startDate", "endDate"]),
  whole: (raw) => raw,
};

interface Entry {
  url: string;
  file: string;
  kind: keyof typeof pruners;
}

async function record(entries: Entry[], updateManifest = true) {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8").catch(() => "{\"entries\":{}}")) as { capturedAt?: string; entries: Record<string, { file: string; capturedAt: string }> };
  await mkdir(DIR, { recursive: true });
  const capturedAt = new Date().toISOString();
  let index = 0;
  const worker = async () => {
    while (index < entries.length) {
      const entry = entries[index++];
      const response = await fetch(entry.url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${entry.url} -> ${response.status}`);
      const pruned = pruners[entry.kind](await response.json());
      await writeFile(join(DIR, entry.file), `${JSON.stringify(pruned)}\n`);
      if (updateManifest) manifest.entries[entry.url] = { file: entry.file, capturedAt };
      console.log(`ok ${entry.file}`);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  // Gravações avulsas (ex.: jogo ao vivo) não entram no manifesto: a mesma URL já responde o dia gravado antes.
  if (!updateManifest) return;
  manifest.capturedAt = capturedAt;
  const sorted = Object.fromEntries(Object.entries(manifest.entries).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, `${JSON.stringify({ capturedAt, entries: sorted }, null, 1)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const liveIndex = args.indexOf("--live");
  if (liveIndex >= 0) {
    const [date, eventId] = [args[liveIndex + 1], args[liveIndex + 2]];
    await record([
      { url: originUrl.scoreboardDay(date), file: `scoreboard-${date}-live.json`, kind: "scoreboard" },
      { url: originUrl.summary(eventId), file: `summary-${eventId}-live.json`, kind: "summary" },
    ], false);
    return;
  }

  const seasonResponse = await fetch(originUrl.season(2027));
  const season = normalizeSeason(await seasonResponse.json());
  if (!season) throw new Error("season 2027 indisponível");

  const entries: Entry[] = [
    { url: originUrl.scoreboardDay("20261124"), file: "scoreboard-20261124.json", kind: "scoreboard" },
    { url: originUrl.scoreboardDay("20261125"), file: "scoreboard-20261125.json", kind: "scoreboard" },
    { url: originUrl.scoreboardDay("20261126"), file: "scoreboard-20261126.json", kind: "scoreboard" },
    { url: originUrl.summary("401909314"), file: "summary-401909314.json", kind: "summary" },
    { url: originUrl.summary("401909317"), file: "summary-401909317.json", kind: "summary" },
    { url: originUrl.standings(), file: "standings.json", kind: "standings" },
    { url: originUrl.news(), file: "news.json", kind: "news" },
    { url: originUrl.teams(), file: "teams.json", kind: "teams" },
    { url: originUrl.roster("25"), file: "roster-25.json", kind: "roster" },
    { url: originUrl.search("curry"), file: "search-curry.json", kind: "search" },
    { url: originUrl.search("Jaylin"), file: "search-jaylin.json", kind: "search" },
    { url: originUrl.season(2027), file: "season-2027.json", kind: "whole" },
    { url: originUrl.draftCore(2027), file: "draft-core-2027.json", kind: "draftCore" },
    { url: originUrl.draftCore(2026), file: "draft-core-2026.json", kind: "draftCore" },
    { url: originUrl.draftSite(2027), file: "draft-site-2027.json", kind: "draftSite" },
    { url: originUrl.draftSite(2026), file: "draft-site-2026.json", kind: "draftSite" },
    { url: originUrl.cupTournament(), file: "cup-tournament.json", kind: "whole" },
    { url: originUrl.cupSeason(2027), file: "cup-season-2027.json", kind: "whole" },
    ...seasonMonths(season).map((month): Entry => ({ url: originUrl.scoreboardMonth(month), file: `month-${month}.json`, kind: "scoreboard" })),
    ...FEATURED_IDS.flatMap((id): Entry[] => [
      { url: originUrl.athlete(id), file: `athlete-${id}.json`, kind: "athlete" },
      { url: originUrl.overview(id), file: `overview-${id}.json`, kind: "overview" },
    ]),
  ];
  await record(entries);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
