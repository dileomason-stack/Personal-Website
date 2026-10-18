// A hidden terminal, styled like the Claude Code session on the laptop in the intro. Press ` anywhere
// (or the >_ link in the footer). Loaded the first time it's opened.
import { track } from './site-live.js';

const EMAIL = 'dileomason@gmail.com';
const SECTIONS = { work: '#work', experience: '#experience', projects: '#projects', education: '#education', cars: '#cars', photos: '#photos', contact: '#contact', top: '#top' };
const PROJECTS = {
  holdthisthought: ['Hold This Thought', 'iOS app. Say a thought once; it reminds you at the right time or place.'],
  homeroom: ['Homeroom', 'A dashboard where a student’s day starts. Built in four days.'],
  whenworks: ['WhenWorks', 'Upload schedule screenshots; see when the whole group is free.'],
};
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

let el, out, input, history = [], at = 0;

const COMMANDS = {
  help: () => `Commands:
  <b>whoami</b>            who I am
  <b>projects</b>          what I’ve built
  <b>open</b> &lt;project&gt;    open a case study (holdthisthought, homeroom, whenworks)
  <b>ls</b>                sections of this page
  <b>cd</b> &lt;section&gt;      go to a section
  <b>resume</b>            open my resume
  <b>contact</b>           copy my email
  <b>linkedin</b> · <b>github</b>
  <b>lights</b> on|off     light or dark mode
  <b>intro</b>             replay the intro
  <b>time</b>              what time it is for me
  <b>stack</b>             how this site is built
  <b>clear</b> · <b>exit</b>
There are a few more. Have a look around.`,
  whoami: () => `Mason Di Leo. Business Administration + Information Systems at Cal Poly SLO.
Business major at heart, builder in progress: I take on projects that solve real problems
and learn whatever skills they need. Open to internships and co-ops.`,
  projects: () => Object.entries(PROJECTS).map(([k, [name, line]]) => `<b>${name}</b> <span class="t-dim">(${k})</span>\n  ${line}`).join('\n') + `\n\nTry <b>open homeroom</b>.`,
  open: async ([name = '']) => {
    const key = Object.keys(PROJECTS).find(k => k.startsWith(name.toLowerCase().replace(/[^a-z]/g, '')));
    if (!name || !key) return `Which one? ${Object.keys(PROJECTS).join(', ')}`;
    close();
    (await import('./case-study.js')).openCase(key);
    return `Opening ${PROJECTS[key][0]}…`;
  },
  ls: () => Object.keys(SECTIONS).filter(s => s !== 'top').map(s => `${s}/`).join('  '),
  cd: ([where = 'top']) => {
    const key = where.replace(/[/.~]/g, '') || 'top', target = document.querySelector(SECTIONS[key] || '');
    if (!target) return `cd: no such section: ${esc(where)}. Try <b>ls</b>.`;
    close();
    window.siteLenis ? window.siteLenis.scrollTo(target, { offset: -72 }) : target.scrollIntoView({ behavior: 'smooth' });
    return '';
  },
  contact: async () => {
    try { await navigator.clipboard.writeText(EMAIL); return `Copied ${EMAIL} to your clipboard. Say hi.`; }
    catch (e) { return `Email me: <a href="mailto:${EMAIL}">${EMAIL}</a>`; }
  },
  email: (a) => COMMANDS.contact(a),
  resume: () => { window.open('resume/', '_blank', 'noopener'); return `Opening ${link('resume/', 'my resume')} (there’s a PDF download there too).`; },
  cv: (a) => COMMANDS.resume(a),
  linkedin: () => { window.open('https://www.linkedin.com/in/masondileo/', '_blank', 'noopener'); return `Opening ${link('https://www.linkedin.com/in/masondileo/', 'linkedin.com/in/masondileo')}`; },
  github: () => { window.open('https://github.com/dileomason-stack', '_blank', 'noopener'); return `Opening ${link('https://github.com/dileomason-stack', 'github.com/dileomason-stack')}`; },
  lights: ([mode]) => {
    const dark = document.documentElement.dataset.theme === 'night';
    if ((mode === 'off' && dark) || (mode === 'on' && !dark)) return `Already ${mode}.`;
    document.querySelector('.lights')?.click();
    return dark ? 'Lights on.' : 'Lights off. After hours.';
  },
  intro: () => { location.href = '?intro'; return 'Back to the bedroom…'; },
  time: () => document.getElementById('now')?.getAttribute('aria-label') || new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }) + ' in San Luis Obispo.',
  date: (a) => COMMANDS.time(a),
  stack: () => `No framework, no template:
  three.js           the 3D bedroom in the intro
  GSAP + Lenis       scroll and motion
  Matter.js          the letters you can grab
  View Transitions   case studies opening out of their cards
  a JS port of my iOS app’s reminder parser (295/295 tests)
Built with Claude Code. Source: ${link('https://github.com/dileomason-stack/Personal-Website', 'github.com/dileomason-stack/Personal-Website')}`,
  // The ones help doesn't list
  sudo: async (args) => {
    if (args.join(' ').toLowerCase().replace(/\s+/g, ' ') !== 'hire mason') return `sudo: you need a better reason than "${esc(args.join(' '))}".`;
    track('egg/sudo-hire', 'Ran sudo hire mason');
    await print('[sudo] password for recruiter: ********', 'dim', 500);
    await print('Checking references… ✓', 'dim', 600);
    await print('Checking the commit history… ✓', 'dim', 600);
    // A link to click, rather than opening someone's mail app on its own
    return `<b class="t-ok">Access granted.</b> <a href="mailto:${EMAIL}?subject=${encodeURIComponent('Let’s talk')}">Email Mason →</a>`;
  },
  hire: () => 'Did you mean <b>sudo hire mason</b>?',
  claude: () => '✻ Thinking… I helped build this whole site. Mason did the deciding.',
  coffee: () => 'Error 418: I’m a teapot.',
  rm: () => 'Nice try.',
  vim: () => 'You’re stuck in vim now. (Kidding. Press Esc.)',
  exit: () => { close(); return ''; },
  quit: (a) => COMMANDS.exit(a),
  clear: () => { out.innerHTML = ''; return ''; },
  echo: (a) => esc(a.join(' ')),
  secrets: () => `Things to try:
  · the light switch on the wall at the bottom of the page
  · the baseball on that shelf
  · grabbing a letter of the headline
  · flicking a photo off the pile`,
  history: () => history.map((h, i) => `${String(i + 1).padStart(3)}  ${esc(h)}`).join('\n') || '(empty)',
};

const wait = ms => new Promise(r => setTimeout(r, ms));
async function print(html, cls = '', delay = 0) {
  if (delay) await wait(delay);
  const p = document.createElement('div');
  p.className = `t-line ${cls ? `t-${cls}` : ''}`;
  p.innerHTML = html;
  out.appendChild(p);
  out.scrollTop = out.scrollHeight;
}

async function run(raw) {
  const line = raw.trim();
  await print(`<span class="t-prompt">❯</span> ${esc(line)}`, 'cmd');
  if (!line) return;
  history.push(line);
  at = history.length;
  const [name, ...args] = line.split(/\s+/);
  const cmd = COMMANDS[name.toLowerCase()];
  if (!cmd) return print(`command not found: ${esc(name)}. Try <b>help</b>.`, 'err');
  const result = await cmd(args);
  if (result) print(result);
}

function build() {
  const style = document.createElement('style');
  style.textContent = `
  .term{position:fixed;left:50%;bottom:16px;z-index:70;width:min(760px,calc(100vw - 24px));height:min(440px,60vh);display:flex;flex-direction:column;
    translate:-50% 0;border-radius:12px;background:#0d0f0e;color:#d7dbd8;border:1px solid #2a2e2c;box-shadow:0 30px 80px -20px rgb(0 0 0 / .6);
    font:13.5px/1.55 "DM Mono",ui-monospace,Menlo,monospace;transform-origin:50% 100%;animation:termIn .28s cubic-bezier(.2,.8,.2,1)}
  .term[hidden]{display:none}
  @keyframes termIn{from{opacity:0;transform:translateY(16px) scale(.98)}}
  .term-bar{display:flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-bottom:1px solid #222624;color:#7c837f;font-size:12px}
  .term-bar i{width:10px;height:10px;border-radius:50%;background:#3a3f3c}
  .term-bar i:first-child{background:#ff5f57}.term-bar i:nth-child(2){background:#febc2e}.term-bar i:nth-child(3){background:#28c840}
  .term-bar span{flex:1;text-align:center;margin-right:40px}
  .term-bar button{all:unset;cursor:pointer;color:#7c837f;font-size:16px;padding:0 4px}.term-bar button:hover{color:#fff}
  .term-out{flex:1;overflow-y:auto;padding:14px 16px 6px;white-space:pre-wrap;overscroll-behavior:contain}
  .t-line{margin:0 0 6px}
  .t-line b{color:#fff;font-weight:500}
  .t-line a{color:#e8a27c}
  .t-cmd{color:#fff}.t-prompt{color:#d97757}.t-dim,.t-line .t-dim{color:#7c837f}.t-err{color:#f28b82}.t-ok{color:#9eeb1a!important}
  .t-welcome{border:1px solid #d97757;border-radius:8px;padding:10px 12px;margin-bottom:12px;color:#d7dbd8}
  .t-welcome b{color:#d97757}
  .term-in{display:flex;align-items:center;gap:10px;margin:0 12px 12px;padding:9px 12px;border:1px solid #2f3431;border-radius:8px}
  .term-in span{color:#d97757}
  .term-in input{all:unset;flex:1;min-width:0;color:#fff;caret-color:#d97757}
  .term-in:focus-within{border-color:#4a504c}
  @media(max-width:640px){.term{bottom:8px;height:70vh;font-size:12.5px}}`;
  document.head.appendChild(style);
  el = document.createElement('div');
  el.className = 'term';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Terminal');
  el.dataset.lenisPrevent = '';
  el.innerHTML = `<div class="term-bar"><i></i><i></i><i></i><span>mason — portfolio</span><button type="button" aria-label="Close terminal">×</button></div>
    <div class="term-out" aria-live="polite"></div>
    <form class="term-in"><span aria-hidden="true">❯</span><input aria-label="Command" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="type help"></form>`;
  document.body.appendChild(el);
  out = el.querySelector('.term-out');
  input = el.querySelector('input');
  el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; run(v); });
  el.querySelector('.term-bar button').addEventListener('click', close);
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(0, at - 1); input.value = history[at] || ''; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); at = Math.min(history.length, at + 1); input.value = history[at] || ''; }
    else if (e.key === 'Tab') {
      // Complete a command, or a section or project after cd / open
      e.preventDefault();
      const [cmd, arg] = input.value.split(/\s+/);
      const pool = arg !== undefined ? (cmd === 'cd' ? Object.keys(SECTIONS) : cmd === 'open' ? Object.keys(PROJECTS) : []) : Object.keys(COMMANDS);
      const match = pool.filter(p => p.startsWith(arg ?? cmd));
      if (match.length === 1) input.value = arg !== undefined ? `${cmd} ${match[0]}` : `${match[0]} `;
      else if (match.length > 1) print(match.join('  '), 'dim');
    }
  });
  print(`<div class="t-welcome"><b>✻</b> Welcome to Mason’s terminal.\n\n  <span class="t-dim">Type</span> help <span class="t-dim">to see what it can do.</span></div>`);
}

let opener = null;
export function openTerminal() {
  if (!el) build();
  opener = document.activeElement;
  el.hidden = false;
  input.focus({ preventScroll: true });
  track('egg/terminal', 'Opened the terminal');
}
function close() {
  if (!el || el.hidden) return;
  el.hidden = true;
  opener?.focus?.({ preventScroll: true });
}
