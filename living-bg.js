// The hero's living background: a few soft pools of warm light that drift slowly and lean toward the
// cursor, drawn by a small WebGL shader at a fraction of the screen's resolution (soft gradients don't
// need more). Colors come from the theme, so it works in light and dark mode. It only runs while the hero
// is on screen and the tab is visible; without WebGL the static haze stays.
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
const FRAG = `
precision mediump float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
uniform vec3 uBg; uniform vec3 uA; uniform vec3 uB; uniform float uGain;
float blob(vec2 p, vec2 c, float r){ vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; uv.y = 1. - uv.y;
  float aspect = uRes.x / uRes.y, t = uTime;
  vec2 p = vec2(uv.x * aspect, uv.y);
  // A slow ripple so the light flows instead of sliding
  p += .035 * vec2(sin(p.y * 2.6 + t * .21), cos(p.x * 2.2 + t * .17));
  vec2 c1 = vec2((.78 + .1 * sin(t * .11)) * aspect, .28 + .1 * cos(t * .13));
  vec2 c2 = vec2((.22 + .12 * cos(t * .09)) * aspect, .78 + .08 * sin(t * .12));
  vec2 c3 = mix(vec2(.62 * aspect, .5), vec2(uMouse.x * aspect, uMouse.y), .55);
  vec3 col = uBg;
  col = mix(col, uA, uGain * .17 * blob(p, c1, .5));
  col = mix(col, uB, uGain * .24 * blob(p, c2, .55));
  col = mix(col, mix(uA, uB, .5), uGain * .14 * blob(p, c3, .34));
  gl_FragColor = vec4(col, 1.);
}`;

const hex = h => { h = h.trim().replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };

export function init(hero) {
  if (!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-glow';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return;
  const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = name => gl.getUniformLocation(prog, name);
  const uRes = u('uRes'), uTime = u('uTime'), uMouse = u('uMouse'), uBg = u('uBg'), uA = u('uA'), uB = u('uB'), uGain = u('uGain');
  hero.prepend(canvas);
  hero.classList.add('living');

  // Colors from the theme: Bone gets terracotta and a warm peach; Night gets its lime, softer
  const colors = () => {
    const cs = getComputedStyle(document.documentElement), night = document.documentElement.dataset.theme === 'night';
    gl.uniform3fv(uBg, hex(cs.getPropertyValue('--bg')));
    gl.uniform3fv(uA, hex(cs.getPropertyValue('--accent')));
    gl.uniform3fv(uB, night ? [.16, .2, .12] : [.98, .78, .6]);
    gl.uniform1f(uGain, night ? .7 : .6);
  };
  colors();
  new MutationObserver(colors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const SCALE = .35;
  const size = () => {
    const w = Math.max(1, Math.round(hero.clientWidth * SCALE)), h = Math.max(1, Math.round(hero.clientHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); gl.uniform2f(uRes, w, h); }
  };
  new ResizeObserver(size).observe(hero);
  size();

  const mouse = { x: .62, y: .5, tx: .62, ty: .5 };
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left) / r.width; mouse.ty = (e.clientY - r.top) / r.height;
  });
  hero.addEventListener('pointerleave', () => { mouse.tx = .62; mouse.ty = .5; });

  let raf = 0, visible = true, t0 = performance.now();
  const frame = now => {
    raf = 0;
    if (!visible || document.hidden) return;
    mouse.x += (mouse.tx - mouse.x) * .04; mouse.y += (mouse.ty - mouse.y) * .04;
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; start(); }).observe(hero);
  document.addEventListener('visibilitychange', start);
  start();
  requestAnimationFrame(() => canvas.classList.add('on'));
}
