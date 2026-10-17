// Bakes data/activity.json (Mason's commits per day across his repos, for the activity strip) and
// data/builds.json (every commit of the public projects, for their build logs). Run before deploying (needs the GitHub CLI, logged in):
//   node scripts/build-activity.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const OWNER = 'dileomason-stack';
// Display names; private repos show up only as counts under their project name.
const REPOS = {
  'Personal-Website': 'This site',
  'hold-this-thought': 'Hold This Thought',
  'holdthisthought': 'Hold This Thought site',
  'Project---Homeroom-': 'Homeroom',
  'Project---WhenWorks': 'WhenWorks',
  'Dream-Car-Finder': 'Dream Car Finder',
  'Flappy-Bird': 'Flappy Bird',
  'dileomason-stack': 'GitHub profile',
};

const gh = args => JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 })).flat();
const days = {};
const repos = [];
// Public projects whose commit messages show in their build logs
const BUILDS = { 'Project---Homeroom-': 'homeroom', 'Project---WhenWorks': 'whenworks' };
const builds = {};
for (const [repo, name] of Object.entries(REPOS)) {
  const commits = gh([`repos/${OWNER}/${repo}/commits?per_page=100`]);
  const seen = new Set();
  let count = 0;
  for (const c of commits) {
    if (seen.has(c.sha) || c.commit.message.startsWith('Merge ')) continue;
    seen.add(c.sha);
    // The day in Mason's time zone, not UTC
    const day = new Date(c.commit.author.date).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    (days[day] ??= {})[name] = (days[day][name] ?? 0) + 1;
    count++;
    if (BUILDS[repo]) (builds[BUILDS[repo]] ??= []).push([c.commit.author.date, c.commit.message.split('\n')[0]]);
  }
  repos.push({ name, count });
  console.log(`${name}: ${count}`);
}
repos.sort((a, b) => b.count - a.count);
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/activity.json', import.meta.url), JSON.stringify({ updated: new Date().toISOString().slice(0, 10), repos, days }));
for (const list of Object.values(builds)) list.sort((a, b) => a[0].localeCompare(b[0]));
writeFileSync(new URL('../data/builds.json', import.meta.url), JSON.stringify(builds));
