// Gerador do mascote castor — cada pose vira um SVG standalone com CSS embutido.
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const C = {
  ol: '#22163A',       // contorno
  fur: '#9C6440', furD: '#7B4A2E', furL: '#F3D5AF',
  ear: '#C7836A',
  tooth: '#FFFDF5',
  brow: '#3A2216',
  hood: '#6B4CF5', hoodD: '#4E35C9', hoodL: '#8A70FF',
  cyan: '#3CD3F5', cyanD: '#159FCB',
  lensA: '#191547', lensB: '#3F35C2', lensC: '#9A7CFF',
  frame: '#15102A',
  cloud: '#F4F3FF', cloudS: '#CFCBF7',
  tail: '#5A3826', tailD: '#432819',
  mouth: '#4A1838', tongue: '#F27C9B',
  white: '#FFFFFF',
};
const SW = 4;

// ---------- formas base ----------
const HEAD = 'M 180 56 C 230 56 264 86 266 126 C 267 140 266 150 263 158 L 275 164 L 261 171 L 269 181 L 252 183 C 236 195 210 201 180 201 C 150 201 124 195 108 183 L 91 181 L 99 171 L 85 164 L 97 158 C 94 150 93 140 94 126 C 96 86 130 56 180 56 Z';
const TUFT = 'M 156 70 C 152 48 168 34 192 34 C 185 41 188 47 199 47 C 193 54 196 60 206 63 C 190 66 172 68 156 70 Z';
const MUZZLE = 'M 180 139 C 170 127 137 127 131 151 C 127 173 149 189 180 183 C 211 189 233 173 229 151 C 223 127 190 127 180 139 Z';
const NOSE = 'M 166 140 C 166 131 194 131 194 140 C 194 148 186 153 180 153 C 174 153 166 148 166 140 Z';
const LENS_L = 'M 108 100 L 174 100 C 178 100 179 103 178 106 L 173 122 C 170 130 164 134 156 134 L 128 134 C 118 134 112 129 110 121 L 106 105 C 105 102 106 100 108 100 Z';
const LENS_R = 'M 252 100 L 186 100 C 182 100 181 103 182 106 L 187 122 C 190 130 196 134 204 134 L 232 134 C 242 134 248 129 250 121 L 254 105 C 255 102 254 100 252 100 Z';
const BODY = 'M 120 204 C 102 210 98 230 97 252 L 98 268 Q 99 278 110 278 L 250 278 Q 261 278 262 268 L 263 252 C 262 230 258 210 240 204 C 220 198 140 198 120 204 Z';
const CLOUD = [[60, 334, 16], [92, 322, 23], [134, 315, 26], [180, 312, 27], [226, 315, 26], [268, 322, 23], [300, 334, 16]];
const CLOUD_RECT = [44, 320, 272, 30, 14];

function defs(p) {
  return `<defs>
  <linearGradient id="${p}-hood" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.hoodL}"/><stop offset="1" stop-color="${C.hood}"/>
  </linearGradient>
  <linearGradient id="${p}-lens" x1="0" y1="0" x2="0.25" y2="1">
    <stop offset="0" stop-color="${C.lensA}"/><stop offset=".55" stop-color="${C.lensB}"/><stop offset="1" stop-color="${C.lensC}"/>
  </linearGradient>
  <pattern id="${p}-hatch" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <path d="M0 0 V11 M0 0 H11" stroke="${C.tailD}" stroke-width="2.4"/>
  </pattern>
  <clipPath id="${p}-lenses"><path d="${LENS_L}"/><path d="${LENS_R}"/></clipPath>
  <clipPath id="${p}-body"><path d="${BODY}"/></clipPath>
  <clipPath id="${p}-cloud">${cloudShapes()}</clipPath>
</defs>`;
}

function cloudShapes(dy = 0, dr = 0) {
  const [x, y, w, h, rx] = CLOUD_RECT;
  return CLOUD.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy + dy}" r="${r + dr}"/>`).join('') +
    `<rect x="${x - dr}" y="${y + dy}" width="${w + dr * 2}" height="${h + dr}" rx="${rx}"/>`;
}

// ---------- partes ----------
function tail(p) {
  return `<g class="${p}-tail">
  <g transform="rotate(62 284 270)">
    <ellipse cx="284" cy="270" rx="25" ry="50" fill="${C.tail}" stroke="${C.ol}" stroke-width="${SW}"/>
    <ellipse cx="284" cy="272" rx="18" ry="41" fill="url(#${p}-hatch)"/>
    <ellipse cx="276" cy="246" rx="5" ry="14" fill="#fff" opacity=".14"/>
  </g>
</g>`;
}

function cloud(p) {
  return `<g class="${p}-cloud">
  <g fill="${C.ol}" stroke="${C.ol}" stroke-width="${SW * 2}">${cloudShapes()}</g>
  <g fill="${C.cloudS}">${cloudShapes()}</g>
  <g fill="${C.cloud}" clip-path="url(#${p}-cloud)">${cloudShapes(-7, -3)}</g>
  <g fill="#fff" opacity=".9">
    <ellipse cx="82" cy="314" rx="8" ry="4" transform="rotate(-30 82 314)"/>
    <ellipse cx="122" cy="302" rx="9" ry="4" transform="rotate(-20 122 302)"/>
    <ellipse cx="54" cy="328" rx="5" ry="3" transform="rotate(-35 54 328)"/>
  </g>
  <ellipse class="${p}-shadow" cx="180" cy="309" rx="64" ry="7" fill="${C.cloudS}"/>
</g>`;
}

function emblem(cx, cy, s = 1) {
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
  <path d="M0 -21 L18 -15 L18 -2 C18 10 10 17 0 21 C-10 17 -18 10 -18 -2 L-18 -15 Z" fill="${C.cyan}" stroke="${C.ol}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M0 -21 L18 -15 L18 -2 C18 10 10 17 0 21 Z" fill="${C.cyanD}" opacity=".35"/>
  <path d="M-5.5 -1 V-6 A5.5 5.5 0 0 1 5.5 -6 V-1" fill="none" stroke="${C.ol}" stroke-width="3" stroke-linecap="round"/>
  <rect x="-8" y="-2" width="16" height="12" rx="2.5" fill="${C.ol}"/>
  <circle cx="0" cy="3.4" r="2" fill="${C.cyan}"/>
</g>`;
}

function body(p) {
  return `<g class="${p}-body">
  <path d="${BODY}" fill="url(#${p}-hood)"/>
  <g clip-path="url(#${p}-body)">
    <path d="M 232 200 C 254 212 258 236 256 270 L 254 292 L 280 292 L 280 200 Z" fill="${C.hoodD}" opacity=".5"/>
    <rect x="90" y="264" width="180" height="20" fill="${C.hoodD}"/>
    <path d="M 90 264 L 270 264" stroke="${C.ol}" stroke-width="3"/>
  </g>
  <path d="${BODY}" fill="none" stroke="${C.ol}" stroke-width="${SW}" stroke-linejoin="round"/>
  <path d="M 114 211 C 120 186 240 186 246 211 C 242 228 118 228 114 211 Z" fill="${C.hoodD}" stroke="${C.ol}" stroke-width="${SW}"/>
  <g stroke-linecap="round">
    <path d="M 166 221 Q 162 230 163 238 M 194 221 Q 198 230 197 238" stroke="${C.ol}" stroke-width="8" fill="none"/>
    <path d="M 166 221 Q 162 230 163 238 M 194 221 Q 198 230 197 238" stroke="#ECE9FF" stroke-width="4" fill="none"/>
  </g>
  <rect x="158.5" y="235" width="9" height="10" rx="2.5" fill="${C.cyan}" stroke="${C.ol}" stroke-width="3"/>
  <rect x="192.5" y="235" width="9" height="10" rx="2.5" fill="${C.cyan}" stroke="${C.ol}" stroke-width="3"/>
  ${emblem(222, 226, 0.68)}
</g>`;
}

// bolso canguru (vai na frente dos braços quando as mãos estão no bolso)
function pocket(p) {
  return `<path d="M 134 246 Q 134 239 141 239 L 219 239 Q 226 239 226 246 L 230 264 L 130 264 Z" fill="${C.hood}" stroke="${C.ol}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M 142 244 L 218 244" stroke="${C.hoodL}" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`;
}

// pernas + tênis
function shoe(cx, dir) {
  // dir = -1 (esquerdo, bico pra esquerda) | 1 (direito)
  const x = (v) => cx + v * dir;
  return `<g>
  <path d="M ${x(-22)} 303 C ${x(-24)} 291 ${x(-12)} 285 ${x(2)} 285 C ${x(16)} 285 ${x(24)} 292 ${x(24)} 303 Z" fill="#F6F5FF" stroke="${C.ol}" stroke-width="${SW}" stroke-linejoin="round"/>
  <path d="M ${x(-14)} 297 L ${x(14)} 292" stroke="${C.cyan}" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M ${x(-3)} 289 L ${x(9)} 289" stroke="${C.ol}" stroke-width="2.4" stroke-linecap="round"/>
  <rect x="${Math.min(x(-28), x(26))}" y="300" width="54" height="10" rx="5" fill="${C.hood}" stroke="${C.ol}" stroke-width="${SW}"/>
</g>`;
}
function legs(p) {
  return `<g class="${p}-legs">
  <rect x="140" y="268" width="22" height="28" rx="6" fill="${C.furD}" stroke="${C.ol}" stroke-width="${SW}"/>
  <rect x="198" y="268" width="22" height="28" rx="6" fill="${C.furD}" stroke="${C.ol}" stroke-width="${SW}"/>
</g>`;
}
function shoes(p) { return `<g class="${p}-shoes">${shoe(148, -1)}${shoe(212, 1)}</g>`; }

function glasses(p, mode) {
  if (mode === 'none') return '';
  const t = { on: '', up: 'translate(180 117) scale(.86) translate(-180 -117) translate(0 -54)', down: 'rotate(-5 180 130) translate(0 15)' }[mode];
  return `<g class="${p}-glasses" transform="${t}">
  <path d="M 106 104 L 94 111 M 254 104 L 266 111" stroke="${C.frame}" stroke-width="5" stroke-linecap="round"/>
  <path d="${LENS_L}" fill="url(#${p}-lens)"/>
  <path d="${LENS_R}" fill="url(#${p}-lens)"/>
  <g clip-path="url(#${p}-lenses)">
    <path d="M 120 134 L 140 100 L 152 100 L 132 134 Z M 136 134 L 156 100 L 161 100 L 141 134 Z M 196 134 L 216 100 L 228 100 L 208 134 Z M 212 134 L 232 100 L 237 100 L 217 134 Z" fill="#fff" opacity=".28"/>
    <g class="${p}-glint"><path d="M 60 140 L 84 96 L 104 96 L 80 140 Z" fill="#fff" opacity=".75"/></g>
  </g>
  <path d="${LENS_L}" fill="none" stroke="${C.frame}" stroke-width="5" stroke-linejoin="round"/>
  <path d="${LENS_R}" fill="none" stroke="${C.frame}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M 108 100 L 174 100 M 186 100 L 252 100" stroke="${C.frame}" stroke-width="8" stroke-linecap="round"/>
  <path d="M 175 104 Q 180 99 185 104" stroke="${C.frame}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="118" cy="104" r="2.2" fill="#C9D4FF"/><circle cx="242" cy="104" r="2.2" fill="#C9D4FF"/>
</g>`;
}

function eye(cx, cy, look = [2, 2]) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="14" ry="16" fill="#fff" stroke="${C.ol}" stroke-width="3.5"/>
  <circle cx="${cx + look[0]}" cy="${cy + look[1]}" r="8.5" fill="${C.ol}"/>
  <circle cx="${cx + look[0] + 3.5}" cy="${cy + look[1] - 3.5}" r="3" fill="#fff"/>`;
}
function happyEye(cx, cy) {
  return `<path d="M ${cx - 14} ${cy + 4} Q ${cx} ${cy - 12} ${cx + 14} ${cy + 4}" fill="none" stroke="${C.ol}" stroke-width="5" stroke-linecap="round"/>`;
}
function lidEye(cx, cy) {
  return `<g><ellipse cx="${cx}" cy="${cy}" rx="13" ry="13" fill="#fff" stroke="${C.ol}" stroke-width="3.5"/>
  <circle cx="${cx + 1}" cy="${cy + 4}" r="7" fill="${C.ol}"/><circle cx="${cx + 4}" cy="${cy + 2}" r="2.4" fill="#fff"/>
  <path d="M ${cx - 15} ${cy} A 15 15 0 0 1 ${cx + 15} ${cy} Z" fill="${C.fur}"/>
  <path d="M ${cx - 15} ${cy} L ${cx + 15} ${cy}" stroke="${C.ol}" stroke-width="4" stroke-linecap="round"/></g>`;
}

function eyes(p, mode) {
  const L = [148, 118], R = [212, 118];
  switch (mode) {
    case 'open': return eye(...L) + eye(...R);
    case 'wink': return `<g class="${p}-blink">${eye(...L)}</g>` + happyEye(...R);
    case 'happy': return happyEye(...L) + happyEye(...R);
    case 'lidded': return lidEye(148, 104) + lidEye(212, 104);
    case 'peek': return `<g class="${p}-blink">${eye(148, 101, [3, -1]).replace(/rx="14" ry="16"/g, 'rx="13" ry="14"')}${eye(212, 100, [3, -1]).replace(/rx="14" ry="16"/g, 'rx="13" ry="14"')}</g>`;
    case 'lookup': return `<g class="${p}-blink">${eye(L[0], L[1], [4, -6])}${eye(R[0], R[1], [4, -6])}</g>`;
    default: return '';
  }
}

function brows(mode) {
  const d = {
    cool: 'M 122 90 Q 140 84 160 88 M 200 83 Q 220 72 240 80',
    up: 'M 122 92 Q 140 80 160 88 M 200 88 Q 220 80 238 92',
    upHigh: 'M 124 78 Q 142 66 160 74 M 200 74 Q 218 66 236 78',
    skeptic: 'M 124 86 Q 142 84 160 88 M 200 80 Q 218 64 238 72',
    worried: 'M 122 84 Q 140 82 158 74 M 202 74 Q 220 82 238 84',
    think: 'M 124 92 Q 142 86 160 94 M 200 92 Q 220 82 238 88',
  }[mode];
  return `<path d="${d}" fill="none" stroke="${C.brow}" stroke-width="7" stroke-linecap="round"/>`;
}

function teeth(y = 160, h = 22) {
  return `<path d="M 170 ${y} L 190 ${y} L 190 ${y + h - 4} Q 190 ${y + h} 186 ${y + h} L 174 ${y + h} Q 170 ${y + h} 170 ${y + h - 4} Z" fill="${C.tooth}" stroke="${C.ol}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M 180 ${y + 1} L 180 ${y + h - 1}" stroke="${C.ol}" stroke-width="2.5"/>`;
}

function mouth(mode) {
  const st = `fill="none" stroke="${C.ol}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"`;
  switch (mode) {
    case 'smirk':
      return teeth(160, 23) + `<path d="M 180 152 L 180 160 M 161 159 Q 171 168 180 160 Q 191 167 206 154 L 211 151" ${st}/>`;
    case 'grin':
      return `<path d="M 152 158 C 158 190 204 192 210 154 C 194 164 168 166 152 158 Z" fill="${C.mouth}" stroke="${C.ol}" stroke-width="3.6" stroke-linejoin="round"/>
      <path d="M 166 178 C 174 172 190 172 198 180 C 190 186 172 186 166 178 Z" fill="${C.tongue}"/>` + teeth(158, 18) +
        `<path d="M 180 152 L 180 160" ${st}/>`;
    case 'open':
      return `<path d="M 150 158 C 154 200 206 200 210 158 C 194 166 166 166 150 158 Z" fill="${C.mouth}" stroke="${C.ol}" stroke-width="3.6" stroke-linejoin="round"/>
      <path d="M 162 184 C 172 176 190 176 198 186 C 190 194 170 194 162 184 Z" fill="${C.tongue}"/>` + teeth(159, 18) +
        `<path d="M 180 152 L 180 160" ${st}/>`;
    case 'eh':
      return teeth(162, 19) + `<path d="M 180 153 L 180 161 M 160 163 Q 170 159 180 162 Q 192 166 204 160" ${st}/>`;
    case 'eek':
      return `<path d="M 154 160 Q 180 155 206 160 Q 209 174 198 178 Q 180 182 162 178 Q 151 174 154 160 Z" fill="${C.mouth}" stroke="${C.ol}" stroke-width="3.6" stroke-linejoin="round"/>
      <path d="M 158 162 L 202 162 L 201 167 L 159 167 Z" fill="${C.tooth}"/>` + teeth(157, 18) + `<path d="M 180 152 L 180 158" ${st}/>`;
    case 'hmm':
      return teeth(161, 20) + `<path d="M 180 153 L 180 161 M 166 162 Q 174 166 180 161 Q 186 164 194 162" ${st}/>`;
    default: return '';
  }
}

function head(p, o) {
  return `<g class="${p}-head">
  <path d="${TUFT}" fill="${C.fur}" stroke="${C.ol}" stroke-width="${SW}" stroke-linejoin="round"/>
  <circle cx="114" cy="82" r="19" fill="${C.fur}" stroke="${C.ol}" stroke-width="${SW}"/>
  <circle cx="246" cy="82" r="19" fill="${C.fur}" stroke="${C.ol}" stroke-width="${SW}"/>
  <circle cx="115" cy="84" r="9" fill="${C.ear}"/><circle cx="245" cy="84" r="9" fill="${C.ear}"/>
  <path d="${HEAD}" fill="${C.fur}" stroke="${C.ol}" stroke-width="${SW}" stroke-linejoin="round"/>
  <path d="${MUZZLE}" fill="${C.furL}" stroke="${C.ol}" stroke-width="3" stroke-linejoin="round"/>
  <g fill="${C.furD}" opacity=".7"><circle cx="148" cy="160" r="2.2"/><circle cx="142" cy="152" r="2.2"/><circle cx="154" cy="151" r="2.2"/><circle cx="212" cy="160" r="2.2"/><circle cx="218" cy="152" r="2.2"/><circle cx="206" cy="151" r="2.2"/></g>
  ${mouth(o.mouth)}
  <path d="${NOSE}" fill="${C.ol}"/>
  <ellipse cx="174" cy="138" rx="4.5" ry="2.6" fill="#fff" opacity=".7"/>
  ${o.glasses === 'down' ? eyes(p, o.eyes) + glasses(p, 'down') + brows(o.brows) : ''}
  ${o.glasses === 'on' ? glasses(p, 'on') + brows(o.brows) : ''}
  ${o.glasses === 'up' ? eyes(p, o.eyes) + brows(o.brows) + glasses(p, 'up') : ''}
  ${o.glasses === 'none' ? eyes(p, o.eyes) + brows(o.brows) : ''}
  ${o.extraHead || ''}
</g>`;
}

// braço = traço grosso (contorno + preenchimento) + pata
function arm(d, paw = '') {
  return `<g><path d="${d}" fill="none" stroke="${C.ol}" stroke-width="33" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${d}" fill="none" stroke="${C.hood}" stroke-width="25" stroke-linecap="round" stroke-linejoin="round"/>${paw}</g>`;
}
function paw(x, y, r = 13, rot = 0) {
  return `<g transform="rotate(${rot} ${x} ${y})"><circle cx="${x}" cy="${y}" r="${r}" fill="${C.fur}" stroke="${C.ol}" stroke-width="${SW}"/>
  <path d="M ${x - 4} ${y - r + 3} L ${x - 4} ${y - r + 9} M ${x + 4} ${y - r + 3} L ${x + 4} ${y - r + 9}" stroke="${C.ol}" stroke-width="2.6" stroke-linecap="round"/></g>`;
}
function thumbsUp(x, y, rot = 0) {
  return `<g transform="rotate(${rot} ${x} ${y})">
  <rect x="${x - 6}" y="${y - 30}" width="13" height="24" rx="6.5" fill="${C.fur}" stroke="${C.ol}" stroke-width="${SW}"/>
  <rect x="${x - 15}" y="${y - 12}" width="30" height="26" rx="11" fill="${C.fur}" stroke="${C.ol}" stroke-width="${SW}"/>
  <path d="M ${x + 15} ${y - 3} L ${x + 6} ${y - 3} M ${x + 15} ${y + 5} L ${x + 6} ${y + 5}" stroke="${C.ol}" stroke-width="2.6" stroke-linecap="round"/>
</g>`;
}
function fist(x, y, r = 15) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.fur}" stroke="${C.ol}" stroke-width="${SW}"/>
  <path d="M ${x - 7} ${y - 4} Q ${x} ${y - 8} ${x + 7} ${y - 4}" stroke="${C.ol}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
}

function sparkle(x, y, s, color, cls) {
  return `<g class="${cls}" style="transform-origin:${x}px ${y}px"><path transform="translate(${x} ${y}) scale(${s})" d="M0 -12 C1.5 -3 3 -1.5 12 0 C3 1.5 1.5 3 0 12 C-1.5 3 -3 1.5 -12 0 C-3 -1.5 -1.5 -3 0 -12 Z" fill="${color}" stroke="${C.ol}" stroke-width="${2.5 / s}" stroke-linejoin="round"/></g>`;
}

// ---------- CSS ----------
function css(p, extra = '') {
  return `<style>
.${p}-all{animation:${p}-float 3.4s ease-in-out infinite;transform-box:view-box;transform-origin:180px 300px}
.${p}-tail{animation:${p}-wag 1.8s ease-in-out infinite;transform-box:view-box;transform-origin:248px 282px}
.${p}-glint{animation:${p}-glint 4.5s ease-in-out infinite}
.${p}-blink{animation:${p}-blink 4s infinite;transform-box:fill-box;transform-origin:center}
@keyframes ${p}-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes ${p}-wag{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(7deg)}}
@keyframes ${p}-glint{0%,55%{transform:translateX(0)}80%,100%{transform:translateX(230px)}}
@keyframes ${p}-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
${extra}
@media (prefers-reduced-motion:reduce){.${p}-root *{animation:none!important}}
</style>`;
}

function svg(p, inner, extraCss = '', vb = '0 0 360 360') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="${p}-root" role="img">
${css(p, extraCss)}
${defs(p)}
${inner}
</svg>`;
}

module.exports = { C, SW, defs, tail, cloud, body, pocket, legs, shoes, head, arm, paw, thumbsUp, fist, sparkle, emblem, svg, glasses, eyes, brows, mouth, HEAD, TUFT, OUT };

// ---------- poses ----------
const poses = {};

// estrutura: nuvem fixa + personagem (que pode pular) por cima
const char = (p, inner, flame = '') => `<g class="${p}-all">
  ${cloud(p)}
  <g class="${p}-char">
    ${flame}
    ${tail(p)}
    ${legs(p)}
    ${body(p)}
    ${shoes(p)}
    ${inner}
  </g>
</g>`;
const armPocketL = arm('M 110 224 C 99 244 112 252 140 252');
const armPocketR = arm('M 250 224 C 261 244 248 252 220 252');
const HOP_ORIGIN = 'transform-box:view-box;transform-origin:180px 310px';

poses.neutro = (p = 'cn') => svg(p, `<title>Castor — neutro</title>
${char(p, `
  ${head(p, { glasses: 'on', brows: 'cool', mouth: 'smirk' })}
  ${armPocketL}${armPocketR}${pocket(p)}`)}`);

poses.acertou = (p = 'ca') => svg(p, `<title>Castor — acertou</title>
${char(p, `
  ${head(p, { glasses: 'up', eyes: 'wink', brows: 'up', mouth: 'grin' })}
  ${armPocketL}${pocket(p)}
  ${arm('M 250 224 C 278 218 294 198 296 176', thumbsUp(298, 166, 12))}`)}
${sparkle(60, 92, 1.3, C.cyan, `${p}-sp ${p}-sp1`)}
${sparkle(320, 92, 1.0, '#FFD34D', `${p}-sp ${p}-sp2`)}
${sparkle(46, 190, .8, C.hoodL, `${p}-sp ${p}-sp3`)}
${sparkle(332, 214, .7, C.cyan, `${p}-sp ${p}-sp1`)}`,
`.${p}-char{animation:${p}-hop 1.3s cubic-bezier(.3,.7,.4,1) infinite;${HOP_ORIGIN}}
@keyframes ${p}-hop{0%,100%{transform:translateY(0) scale(1,1)}12%{transform:translateY(0) scale(1.04,.96)}40%{transform:translateY(-18px) scale(.98,1.03)}70%{transform:translateY(0) scale(1,1)}}
.${p}-shadow{animation:${p}-shadow 1.3s cubic-bezier(.3,.7,.4,1) infinite;transform-box:fill-box;transform-origin:center}
@keyframes ${p}-shadow{0%,12%,70%,100%{transform:scaleX(1);opacity:1}40%{transform:scaleX(.75);opacity:.6}}
.${p}-sp{animation:${p}-tw 1.3s ease-in-out infinite;transform-box:view-box}
.${p}-sp2{animation-delay:.3s}.${p}-sp3{animation-delay:.6s}
@keyframes ${p}-tw{0%,100%{transform:scale(.4) rotate(0);opacity:.2}50%{transform:scale(1.1) rotate(45deg);opacity:1}}`);

poses.errou = (p = 'ce') => svg(p, `<title>Castor — errou</title>
${char(p, `
  <g class="${p}-tilt">
  ${head(p, { glasses: 'down', eyes: 'peek', brows: 'worried', mouth: 'eek' })}
  </g>
  ${armPocketL}${pocket(p)}
  ${arm('M 250 224 C 290 212 300 166 276 118', paw(270, 110, 14, -30))}
  <g class="${p}-drop"><path d="M 86 88 C 80 100 76 106 76 112 A 10 10 0 0 0 96 112 C 96 106 92 100 86 88 Z" fill="#9BE7FF" stroke="${C.ol}" stroke-width="3.2" stroke-linejoin="round"/>
  <ellipse cx="82" cy="111" rx="2.4" ry="4" fill="#fff"/></g>`)}`,
`.${p}-tilt{animation:${p}-tilt 3s ease-in-out infinite;transform-box:view-box;transform-origin:180px 205px}
@keyframes ${p}-tilt{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(3deg)}}
.${p}-drop{animation:${p}-drop 2.4s ease-in infinite}
@keyframes ${p}-drop{0%,15%{transform:translateY(0);opacity:1}70%{transform:translateY(14px);opacity:0}71%{transform:translateY(-6px);opacity:0}100%{transform:translateY(0);opacity:1}}`);

const FL = 'M 180 300 C 100 300 44 250 50 180 C 54 136 74 112 64 70 C 92 90 104 112 106 132 C 104 92 116 60 112 30 C 140 54 150 80 152 100 C 158 64 170 30 184 0 C 200 34 212 64 212 96 C 222 74 240 54 252 34 C 262 70 260 104 254 128 C 270 112 288 96 300 76 C 312 116 314 150 310 180 C 316 250 260 300 180 300 Z';
const CONF = [[30, 40, C.cyan, 0], [24, 120, '#FFD34D', .4], [44, 210, '#F27C9B', .9], [330, 40, '#F27C9B', .2], [338, 130, C.cyan, .7], [322, 220, '#FFD34D', 1.1], [140, 14, '#FFD34D', 1.4], [232, 12, C.cyan, 1.6], [96, 60, C.hoodL, .5], [270, 56, '#FFD34D', 1.9]];
poses.streak = (p = 'cs') => svg(p, `<title>Castor — streak</title>
${char(p, `
  ${head(p, { glasses: 'on', brows: 'upHigh', mouth: 'open' })}
  ${pocket(p)}
  ${arm('M 112 226 C 86 212 70 182 72 150', fist(72, 140))}
  ${arm('M 248 226 C 274 212 290 182 288 150', fist(288, 140))}`,
`<g class="${p}-flame"><g transform="translate(180 296) scale(.94 .84) translate(-180 -300)">
    <path d="${FL}" fill="#FF7A2F" stroke="${C.ol}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="${FL}" fill="#FFB938" transform="translate(180 300) scale(.74 .8) translate(-180 -300)"/>
    <path d="${FL}" fill="#FFF1B8" transform="translate(180 300) scale(.46 .58) translate(-180 -300)"/>
  </g></g>`)}
${CONF.map(([x, y, c, d], i) => `<g class="${p}-cf" style="animation-delay:${d}s"><rect x="${x}" y="${y}" width="${i % 2 ? 7 : 10}" height="${i % 2 ? 12 : 6}" rx="1.5" fill="${c}" stroke="${C.ol}" stroke-width="2" transform="rotate(${i * 37} ${x} ${y})"/></g>`).join('')}`,
`.${p}-char{animation:${p}-jump 1s cubic-bezier(.3,.7,.4,1) infinite;${HOP_ORIGIN}}
@keyframes ${p}-jump{0%,100%{transform:translateY(0)}45%{transform:translateY(-12px)}}
.${p}-flame{animation:${p}-flick .45s ease-in-out infinite alternate;transform-box:view-box;transform-origin:180px 296px}
@keyframes ${p}-flick{0%{transform:scale(1,1) skewX(0)}100%{transform:scale(1.02,1.04) skewX(-2deg)}}
.${p}-cf{animation:${p}-fall 2.2s linear infinite;transform-box:fill-box;transform-origin:center}
@keyframes ${p}-fall{0%{transform:translateY(-90px) rotate(0);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateY(160px) rotate(220deg);opacity:0}}`);

poses.pensando = (p = 'cp') => svg(p, `<title>Castor — pensando</title>
${char(p, `
  ${head(p, { glasses: 'up', eyes: 'lookup', brows: 'think', mouth: 'hmm' })}
  ${pocket(p)}
  ${arm('M 110 224 C 100 252 118 262 150 260 L 222 256', paw(230, 254, 13, 75))}
  ${arm('M 250 224 C 270 250 252 262 238 250 L 216 212', paw(213, 203, 14, -15))}`)}
<g class="${p}-bubble">
  <circle cx="276" cy="96" r="5" fill="#fff" stroke="${C.ol}" stroke-width="3"/>
  <circle cx="290" cy="76" r="8" fill="#fff" stroke="${C.ol}" stroke-width="3"/>
  <g fill="${C.ol}" stroke="${C.ol}" stroke-width="7"><circle cx="292" cy="40" r="18"/><circle cx="316" cy="32" r="22"/><circle cx="338" cy="42" r="16"/><rect x="280" y="38" width="66" height="22" rx="11"/></g>
  <g fill="#fff"><circle cx="292" cy="40" r="18"/><circle cx="316" cy="32" r="22"/><circle cx="338" cy="42" r="16"/><rect x="280" y="38" width="66" height="22" rx="11"/></g>
  <circle class="${p}-dot" cx="300" cy="44" r="4.5" fill="${C.hood}"/>
  <circle class="${p}-dot ${p}-d2" cx="315" cy="44" r="4.5" fill="${C.hood}"/>
  <circle class="${p}-dot ${p}-d3" cx="330" cy="44" r="4.5" fill="${C.hood}"/>
</g>`,
`.${p}-dot{animation:${p}-dot 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.${p}-d2{animation-delay:.2s}.${p}-d3{animation-delay:.4s}
@keyframes ${p}-dot{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-5px);opacity:1}}
.${p}-bubble{animation:${p}-float 3.4s ease-in-out infinite reverse}`);

// ---------- logo / ícone ----------
const logos = {};
// Badge quadrado arredondado: cabeça + ombros sobre gradiente
logos['castor-logo'] = (p = 'cl') => svg(p, `<title>Castor — logo</title>
<defs>
  <linearGradient id="${p}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4338CA"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient>
  <clipPath id="${p}-badge"><rect x="0" y="0" width="256" height="256" rx="60"/></clipPath>
</defs>
<g clip-path="url(#${p}-badge)">
  <rect width="256" height="256" fill="url(#${p}-bg)"/>
  <circle cx="214" cy="40" r="70" fill="#fff" opacity=".07"/>
  <circle cx="30" cy="236" r="60" fill="#22D3EE" opacity=".12"/>
  <g transform="translate(128 150) scale(.96) translate(-180 -126)">
    ${body(p)}
    ${head(p, { glasses: 'on', brows: 'cool', mouth: 'smirk' })}
  </g>
</g>`, '', '0 0 256 256');

// Só a cabeça, fundo transparente (header, avatar)
const headOnly = (p) => head(p, { glasses: 'on', brows: 'cool', mouth: 'smirk' });
logos['castor-icone'] = (p = 'ci') => svg(p, `<title>Castor</title>${headOnly(p)}`, '', '80 18 200 200');

// Favicon: contornos mais grossos e sem detalhes miúdos pra ler em 16–32px
logos['favicon'] = (p = 'cf') => {
  let h = headOnly(p)
    .replace(/<g fill="#7B4A2E" opacity=".7">.*?<\/g>/s, '')
    .replace(/<circle cx="11[58]" cy="104" r="2.2"[^>]*\/><circle[^>]*\/>/, '')
    .replace(/stroke-width="([\d.]+)"/g, (m, v) => `stroke-width="${(parseFloat(v) * 1.8).toFixed(1)}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="78 16 204 204">${defs(p)}${h}</svg>`;
};

if (require.main === module) {
  for (const [name, fn] of Object.entries(poses)) {
    fs.writeFileSync(path.join(OUT, `castor-${name}.svg`), fn());
  }
  for (const [name, fn] of Object.entries(logos)) {
    fs.writeFileSync(path.join(OUT, `${name}.svg`), fn());
  }
  console.log('ok', Object.keys(poses));
}
