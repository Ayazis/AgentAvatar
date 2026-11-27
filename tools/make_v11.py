"""rosie_v10.html + pose atlas -> rosie_v11.html (Off and Idle jacket poses from ChatGPT's design, our Working lapels)."""
import json, re, sys
P = json.load(open(sys.argv[1]))
h = open("versions/jacket-v10.html", encoding='utf8').read()
def sub(old, new, count=1):
  global h
  assert h.count(old) >= 1, old[:80]
  h = h.replace(old, new) if count == 0 else h.replace(old, new, count)

# data: replace ART / MASKS with the pose atlas, its depth, the panel edges and spans
h = re.sub(r'const ART = "[^"]+";', lambda m: f'const ATLAS = "data:image/webp;base64,{P["atlas"]}";', h)
h = re.sub(r'const MASKS = "[^"]+";', lambda m: f'const DEPTH = "data:image/webp;base64,{P["depth"]}";\nconst BOUNDS = "{P["bounds"]}";', h)
sp = P['spans']
vert = '\n'.join(f'  {"if" if i == 0 else "else if"}(stage<{i}.5) return side<.5 ? vec2({sp[2*i][0]:.5f},{sp[2*i][1]:.5f}) : vec2({sp[2*i+1][0]:.5f},{sp[2*i+1][1]:.5f});' for i in range(3))
JACKET = r'''
// ── the jacket, morphing between three poses (0 off, 1 idle, 2 working).
// Each panel is stored rectified per row; its outline (top/bottom + per-row edges) blends between poses.
uniform sampler2D atlas, depthA, bounds;
uniform float pose;
vec2 vspan(float stage, float side){
VERT
  return vec2(0.,1.);
}
vec2 pEdges(float stage, float side, float v){
  vec4 k = texture2D(bounds, vec2((.5 + 639.*v)/640., (stage*2. + side + .5)/6.));
  return (k.rb*256. + k.ga)/257.;
}
// colour + coverage of one panel; depth out
vec4 panel(vec2 st, float side, out float dep){
  dep = 0.;
  float a = min(floor(pose), 1.), b = a + 1., f = pose - a;
  vec2 span = mix(vspan(a, side), vspan(b, side), f);
  float v = (st.y - span.x)/(span.y - span.x);
  if (v < 0. || v > 1.) return vec4(0.);
  vec2 ext = mix(pEdges(a, side, v), pEdges(b, side, v), f);
  float u = (st.x - ext.x)/max(ext.y - ext.x, .00001);
  if (u < 0. || u > 1.) return vec4(0.);
  vec2 at = vec2((side*512. + .5 + 511.*u)/1024., (.5 + 639.*v)/1920.);
  vec2 oa = vec2(0., a/3.), ob = vec2(0., b/3.);
  dep = mix(texture2D(depthA, at + oa).r, texture2D(depthA, at + ob).r, f);
  return mix(texture2D(atlas, at + oa), texture2D(atlas, at + ob), f);
}
// the right panel lies over the left where they cross. m = (coverage, depth, 0)
vec4 jacket(vec2 st, out vec3 m){
  float dl, dr;
  vec4 L = panel(st, 0., dl), R = panel(st, 1., dr);
  float cov = R.a + L.a*(1. - R.a);
  m = vec3(cov, mix(dl, dr, R.a), 0.);
  return vec4(mix(L.rgb, R.rgb, R.a), cov);
}
vec3 M(vec2 st){ vec3 m; jacket(st, m); return m; }
'''.replace('VERT', vert)

# main shader
sub('uniform sampler2D art, masks, spine;', 'uniform sampler2D spine;')
sub('vec3 M(vec2 st){ return texture2D(masks, clamp(st, vec2(.001), vec2(.999))).rgb; }', JACKET)
sub('''  vec3 m = M(s2);
  float thin''', '''  vec3 m = M(s2);
  float thin''')
sub('''  m = M(s2);
  float den = m.r;
  vec3 col = texture2D(art, s2).rgb;
  vec2 inb = step(vec2(0.), s2)*step(s2, vec2(1.));
  col = mix(bgc, col, inb.x*inb.y);''', '''  vec4 jk = jacket(s2, m);
  float den = m.r;
  vec2 inb = vec2(1.);
  vec3 col = mix(bgc, jk.rgb, den);''')
# off: the jacket stays fully visible; only the light (orb, silk, particles) goes dark
sub('''  vec3 asleep = mix(bgc, mix(vec3(lum), col, .3)*.2, fg);''', '''  vec3 asleep = mix(bgc, jk.rgb, den);''')
# a slightly softer background where there's no denim (the old art carried its own backdrop)
sub('vec3 bgc = vec3(.086,.004,.078);', 'vec3 bgc = mix(vec3(.03,.005,.035), vec3(.086,.004,.078), exp(-3.*dot(screen,screen)));')

# particles: hidden by whichever pose the jacket is in
sub('''precision mediump float;
uniform sampler2D masks;''', '''precision highp float;''' + JACKET)
sub('float den = texture2D(masks, clamp(vSt, vec2(.001), vec2(.999))).r;', 'float den = M(vSt).r;')

# JS: uniforms, textures, pose glide
sub("const UN = ['scene','motion','tap','res','detail','art','masks','spine','silkT','tuneA','tuneB','tuneC'];",
    "const UN = ['scene','motion','tap','res','detail','atlas','depthA','bounds','pose','spine','silkT','tuneA','tuneB','tuneC'];")
sub("this.pLoc = { pos: g.getAttribLocation(pp, 'aPos'), meta: g.getAttribLocation(pp, 'aMeta'), view: g.getUniformLocation(pp, 'view'), masks: g.getUniformLocation(pp, 'masks') };\n    g.useProgram(pp); g.uniform1i(this.pLoc.masks, 1); g.useProgram(p);",
    "this.pLoc = { pos: g.getAttribLocation(pp, 'aPos'), meta: g.getAttribLocation(pp, 'aMeta'), view: g.getUniformLocation(pp, 'view'), pose: g.getUniformLocation(pp, 'pose') };\n"
    "    g.useProgram(pp); [['atlas',0],['depthA',1],['bounds',3]].forEach(([n,u]) => g.uniform1i(g.getUniformLocation(pp, n), u));\n"
    "    g.useProgram(rp); [['atlas',0],['depthA',1],['bounds',3]].forEach(([n,u]) => g.uniform1i(this.ru[n], u)); g.useProgram(p);")
sub("this.textures = [tex(0,'art'), tex(1,'masks'), tex(2,'spine')];", "this.textures = [tex(0,'atlas'), tex(1,'depthA'), tex(2,'spine'), tex(3,'bounds')];")
sub("[[ART, 0, g.RGB], [MASKS, 1, g.RGB]].forEach", """g.activeTexture(g.TEXTURE3); g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 640, 6, 0, g.RGBA, g.UNSIGNED_BYTE, Uint8Array.from(atob(BOUNDS), c => c.charCodeAt(0)));
    [[ATLAS, 0, g.RGBA], [DEPTH, 1, g.RGB]].forEach""")
sub("this.state = 'idle'; this.alive = 1;", "this.state = 'idle'; this.pose = 1; this.poseFrom = 1; this.poseTo = 1; this.poseT = 1e9; this.alive = 1;")
sub("    this.gliding = u < 1;", """    this.gliding = u < 1;
    // the jacket changes pose over the same transition time; switching midway starts from where it is
    const poseTarget = this.state === 'off' ? 0 : this.state === 'idle' ? 1 : 2;
    if (poseTarget !== this.poseTo) { this.poseFrom = this.pose; this.poseTo = poseTarget; this.poseT = 0; }
    this.poseT += dt;
    const pu = this.transition > 0 ? Math.min(1, this.poseT/this.transition) : 1, pe = pu*pu*(3 - 2*pu);
    this.pose = this.poseFrom + (this.poseTo - this.poseFrom)*pe;""")
sub("      g.uniform1f(u.silkT, this.silkT);", "      g.uniform1f(u.silkT, this.silkT);\n      g.uniform1f(u.pose, this.pose);")
sub("    g.uniform2f(this.pLoc.view, aspect, scale);", "    g.uniform2f(this.pLoc.view, aspect, scale);\n    g.uniform1f(this.pLoc.pose, this.pose);")
sub("this.textures.forEach(t => g.deleteTexture(t));", "this.textures.forEach(t => g.deleteTexture(t));")
sub("Two denim lapels around a glowing orb", "A denim jacket that folds shut, half-opens or opens wide around a glowing orb")
open('versions/jacket-v11.html', 'w', encoding='utf8').write(h)
print('ok', len(h))
