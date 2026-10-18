// The laptop screen: a Claude Code session in the Hold This Thought repo, drawn to a canvas.
// It types a request, edits HomeDashboardView.swift (real lines from the app), builds, and
// installs on the phone at INSTALL_AT seconds, which is when the phone shows the new card.
import * as THREE from 'three';

export const INSTALL_AT = 11.0;

const PROMPT = 'When a reminder goes off, pin it to the top of Home with Done and Snooze buttons';
const W = 2048, H = 1152;
const C = {
  bg: '#161616', bar: '#2a2a2a', text: '#f5f3ef', dim: '#8b8b8b', faint: '#5c5c5c',
  orange: '#d97757', green: '#7ec98f', addBg: '#1f3a27', addText: '#bfe6c8', border: '#4a4a4a',
};

// [time, kind, ...]
const SCRIPT = [
  [3.6, 'user', PROMPT],
  [3.6, 'spin', 'Thinking', 5.0],
  [5.0, 'say', 'I’ll add a Went off section to the top of the Home dashboard, with Done and Snooze on each card.'],
  [5.6, 'tool', 'Read', 'FutureYou/HomeDashboardView.swift', 'Read 468 lines'],
  [6.3, 'tool', 'Update', 'FutureYou/HomeDashboardView.swift', 'Updated FutureYou/HomeDashboardView.swift with 86 additions'],
  ...[
    [61, 'if !wentOff.isEmpty { WentOffSection(items: wentOff, onEdit: onEdit) }'],
    [null],
    [470, '/// Reminders that went off and still need Done or Snooze, pinned to the top'],
    [472, 'private struct WentOffSection: View {'],
    [480, '        HStack(spacing: 6) {'],
    [481, '            Image(systemName: "bell.badge.fill")'],
    [482, '            Text("Went off")'],
    [483, '            Text("\\(items.count)").foregroundStyle(.secondary)'],
    [null],
    [529, '            Button { withAnimation { store.complete(memory) } } label: {'],
    [530, '                Label("Done", systemImage: "checkmark")'],
    [538, '            Button { showSnooze = true } label: {'],
    [539, '                Label("Snooze", systemImage: "clock.arrow.circlepath")'],
  ].map(([n, code], i) => [6.5 + i * 0.17, 'diff', n, code]),
  [9.0, 'tool', 'Bash', 'xcodebuild -scheme FutureYou -destination \'name=Mason’s iPhone\' build install', null],
  [9.0, 'spin', 'Building', INSTALL_AT],
  [INSTALL_AT, 'result', '** BUILD SUCCEEDED **  ·  Installed on Mason’s iPhone', C.green],
  [11.6, 'say', 'Done. Reminders that go off now sit in a Went off card above Today, with Done and Snooze. It’s running on your iPhone now.'],
];

export function createTerminal() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Drawn at twice the size it appears on screen (see setResolution) and mipmapped down
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  const MONO = '"DM Mono", Menlo, monospace';
  // Big type so it stays readable at the laptop's size on screen
  const FS = 32, LH = 46, PAD = 40, TOP = 58;
  let lastKey = '';

  function wrap(text, width) {
    const words = text.split(' '), out = [];
    let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (g.measureText(next).width > width && line) { out.push(line); line = w; } else line = next;
    }
    out.push(line);
    return out;
  }

  function bullet(x, y, color) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x + 10, y - 10, 8, 0, Math.PI * 2);
    g.fill();
  }

  function elbow(x, y) {
    g.strokeStyle = C.dim;
    g.lineWidth = 2;
    g.beginPath();
    g.lineWidth = 3;
    g.moveTo(x + 10, y - 32);
    g.lineTo(x + 10, y - 12);
    g.lineTo(x + 30, y - 12);
    g.stroke();
  }

  function update(t) {
    const spinFrame = Math.floor(t * 8);
    const typed = t < 0.6 ? 0 : Math.min(PROMPT.length, Math.floor((t - 0.6) / 2.8 * PROMPT.length));
    const cursorOn = Math.floor(t * 2) % 2 === 0;
    const shown = SCRIPT.filter(e => e[0] <= t).length;
    const spinning = SCRIPT.some(e => e[1] === 'spin' && e[0] <= t && t < e[3]);
    const key = [shown, t < 3.6 ? typed : -1, cursorOn, spinning ? spinFrame : -1].join('|');
    if (key === lastKey) return;
    lastKey = key;
    // Everything below is laid out on a 2048-wide page and scaled to the canvas
    g.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);

    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);

    // Build the log as drawable rows
    const rows = [];
    const textW = W - PAD * 2 - 40;
    g.font = `400 ${FS}px ${MONO}`;
    rows.push({ type: 'welcome', h: LH * 4 + 10 });
    for (const e of SCRIPT) {
      if (e[0] > t) break;
      const [, kind, a, b, c] = e;
      if (kind === 'user') wrap('> ' + a, textW).forEach((l, i) => rows.push({ type: 'user', text: l, gap: i === 0 }));
      else if (kind === 'say') wrap(a, textW).forEach((l, i) => rows.push({ type: 'say', text: l, first: i === 0, gap: i === 0 }));
      else if (kind === 'tool') {
        rows.push({ type: 'tool', name: a, arg: b, gap: true });
        if (c) rows.push({ type: 'result', text: c });
      } else if (kind === 'diff') rows.push({ type: 'diff', n: a, code: b });
      else if (kind === 'result') rows.push({ type: 'result', text: a, color: b });
      else if (kind === 'spin' && t < b) rows.push({ type: 'spin', text: a, since: e[0], gap: true });
    }
    const inputH = LH * 2 + 24;
    const rowH = r => LH + (r.gap ? 12 : 0) + (r.type === 'welcome' ? r.h - LH : 0) + (r.type === 'diff' ? -4 : 0);
    const total = rows.reduce((s, r) => s + rowH(r), 0);
    const avail = H - TOP - PAD * 2 - inputH;
    let y = TOP + PAD + LH - Math.max(0, total - avail);

    for (const r of rows) {
      y += r.gap ? 12 : 0;
      const x = PAD;
      if (r.type === 'welcome') {
        if (y > TOP) {
          g.strokeStyle = C.orange;
          g.lineWidth = 2;
          g.beginPath();
          g.roundRect(x, y - LH + 6, 1060, r.h - 10, 12);
          g.stroke();
          g.font = `500 ${FS}px ${MONO}`;
          g.fillStyle = C.orange;
          g.fillText('✻', x + 28, y + 28);
          g.fillStyle = C.text;
          g.fillText('Welcome to Claude Code!', x + 72, y + 28);
          g.font = `400 ${FS - 2}px ${MONO}`;
          g.fillStyle = C.dim;
          g.fillText('/help for help, /status for your current setup', x + 72, y + 28 + LH + 6);
          g.fillText('cwd: ~/hold-this-thought', x + 72, y + 28 + LH * 2 + 6);
        }
        y += r.h - LH;
      } else if (r.type === 'user') {
        g.font = `400 ${FS}px ${MONO}`;
        g.fillStyle = C.dim;
        g.fillText(r.text, x, y);
      } else if (r.type === 'say') {
        if (r.first) bullet(x, y, C.text);
        g.font = `400 ${FS}px ${MONO}`;
        g.fillStyle = C.text;
        g.fillText(r.text, x + 40, y);
      } else if (r.type === 'tool') {
        bullet(x, y, C.green);
        g.font = `500 ${FS}px ${MONO}`;
        g.fillStyle = C.text;
        g.fillText(r.name, x + 40, y);
        const nw = g.measureText(r.name).width;
        g.font = `400 ${FS}px ${MONO}`;
        g.fillStyle = C.dim;
        g.fillText(`(${r.arg})`, x + 40 + nw, y);
      } else if (r.type === 'result') {
        elbow(x + 26, y);
        g.font = `400 ${FS}px ${MONO}`;
        g.fillStyle = r.color || C.dim;
        g.fillText(r.text, x + 74, y);
      } else if (r.type === 'diff') {
        g.font = `400 ${FS - 2}px ${MONO}`;
        if (r.n == null) {
          g.fillStyle = C.faint;
          g.fillText('     ⋮', x + 74, y - 2);
        } else {
          g.fillStyle = C.addBg;
          g.fillRect(x + 74, y - LH + 12, W - PAD * 2 - 74, LH - 4);
          g.fillStyle = C.dim;
          g.fillText(String(r.n).padStart(4), x + 80, y - 2);
          g.fillStyle = C.green;
          g.fillText('+', x + 172, y - 2);
          g.fillStyle = C.addText;
          g.fillText(r.code, x + 206, y - 2);
        }
      } else if (r.type === 'spin') {
        const glyphs = '·✢✳✶✻✽✻✶✳✢';
        g.font = `500 ${FS}px ${MONO}`;
        g.fillStyle = C.orange;
        g.fillText(glyphs[spinFrame % glyphs.length], x, y);
        g.fillText(r.text + '…', x + 40, y);
        const tw = g.measureText(r.text + '…').width;
        g.font = `400 ${FS}px ${MONO}`;
        g.fillStyle = C.dim;
        g.fillText(` (${Math.floor(t - r.since)}s · esc to interrupt)`, x + 40 + tw, y);
      }
      y += LH + (r.type === 'diff' ? -4 : 0);
    }

    // Input box, pinned to the bottom
    const by = H - PAD - inputH + 4;
    g.fillStyle = C.bg;
    g.fillRect(0, by - 14, W, H - by + 14);
    g.strokeStyle = C.border;
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(PAD, by, W - PAD * 2, LH + 22, 10);
    g.stroke();
    g.font = `400 ${FS}px ${MONO}`;
    g.fillStyle = C.text;
    const draft = t < 3.6 ? PROMPT.slice(0, typed) : '';
    const line = '> ' + draft;
    g.fillText(line, PAD + 22, by + LH - 2);
    if (cursorOn || (t > 0.6 && t < 3.6)) {
      g.fillStyle = C.text;
      g.fillRect(PAD + 22 + g.measureText(line).width + 3, by + 12, 16, LH - 8);
    }
    g.font = `400 ${FS - 4}px ${MONO}`;
    g.fillStyle = C.faint;
    g.fillText('? for shortcuts', PAD + 22, by + LH + 22 + 34);

    // Window chrome, drawn last so scrolled rows slide under it
    g.fillStyle = C.bar;
    g.fillRect(0, 0, W, TOP);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(34 + i * 32, TOP / 2, 10, 0, Math.PI * 2); g.fill(); });
    g.font = `500 24px ${MONO}`;
    g.fillStyle = C.dim;
    g.textAlign = 'center';
    g.fillText('hold-this-thought — claude', W / 2, TOP / 2 + 8);
    g.textAlign = 'left';

    texture.needsUpdate = true;
  }

  // Resize the canvas to px wide (the screen's size on the display, in device pixels); the text is
  // then rendered crisply at that size instead of being shrunk from 2048 on the GPU
  function setResolution(px) {
    const w = Math.round(THREE.MathUtils.clamp(px, 480, W));
    if (Math.abs(w - canvas.width) < 8) return;
    canvas.width = w;
    canvas.height = Math.round(w * H / W);
    texture.dispose();
    lastKey = '';
  }

  update(0);
  return { texture, update, setResolution };
}
