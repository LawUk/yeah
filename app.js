(async function(){

/* ---------- Cargar configuración desde JSON ---------- */
let CFG;
try {
  const resp = await fetch('config.json');
  CFG = await resp.json();
} catch(e) {
  CFG = {
    labels: {
      fuente:"Fuente 5 V", andon:"Andon", buzzer:"Buzzer",
      camara:"Cámara 2K", monitor:"Monitor", nido:"Nido",
      rfid:"RFID", herramientas:"Herramientas", esp32:"ESP32", tablet:"Tablet", cpu:"CPU"
    },
    bins: ["case_bottom","spring_pull","spring_L","spring_R","jaw_L","jaw_R","case_top","tornillos"],
    monitorTexts: { title:"Vista en vivo · cámara 2K", stepInfo:"Secuencia correcta · paso 3 de 8", partLabel:"spring_L  OK" },
    tabletTexts: { step:"Paso 3 de 8", action:"Coloca spring_L", hint:"Toma del bin 3", btnPause:"Pausa", btnAndon:"Llamar Andon" },
    colors: {
      MDF_TOP:"#c7a878", MDF_SIDE:"#b08d5c", MDF_DARK:"#8f6f45",
      BIN_BG:"#e6dcc4", BIN_IN:"#3f3b34", METAL:"#a8adb2", METAL_D:"#7c8187",
      DARK:"#22262a", DARK_2:"#14171b", ACCENT:"#2b6cb0", GREEN:"#34c759"
    }
  };
}

/* ---------- Generar leyenda desde JSON ---------- */
const legendEl = document.getElementById('legendContainer');
CFG.bins.forEach(function(name, i){
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.innerHTML = '<b>' + (i+1) + '</b> ' + name;
  legendEl.appendChild(chip);
});

/* ---------- Colores desde config ---------- */
function hexToInt(h){ return parseInt(h.replace('#',''), 16); }
const MDF_TOP   = hexToInt(CFG.colors.MDF_TOP);
const MDF_SIDE  = hexToInt(CFG.colors.MDF_SIDE);
const MDF_DARK  = hexToInt(CFG.colors.MDF_DARK);
const BIN_BG    = hexToInt(CFG.colors.BIN_BG);
const BIN_IN    = hexToInt(CFG.colors.BIN_IN);
const METAL     = hexToInt(CFG.colors.METAL);
const METAL_D   = hexToInt(CFG.colors.METAL_D);
const DARK      = hexToInt(CFG.colors.DARK);
const DARK_2    = hexToInt(CFG.colors.DARK_2);
const ACCENT    = hexToInt(CFG.colors.ACCENT);
const GREEN     = hexToInt(CFG.colors.GREEN);

const wrap = document.getElementById('wrap');
let renderer;
try{
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'high-performance'});
}catch(e){
  wrap.innerHTML = '<p class="fallback">No se pudo iniciar la vista 3D en este navegador.</p>';
  return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1, 1, 2000);

/* ---------- Iluminación equilibrada ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.32));
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 0.28));

const key = new THREE.DirectionalLight(0xffffff, 0.62);
key.position.set(150, 280, 200);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left   = -200;
key.shadow.camera.right  =  200;
key.shadow.camera.top    =  200;
key.shadow.camera.bottom = -200;
key.shadow.camera.near = 60;
key.shadow.camera.far  = 900;
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.9;
key.shadow.radius = 3;
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 0.14);
fill.position.set(-220, 140, -140);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffe8cc, 0.08);
rim.position.set(-60, 120, -280);
scene.add(rim);

const root = new THREE.Group(); scene.add(root);

const labels = [];
const TY = 75;

/* ---------- Helpers ---------- */
function lam(c){ return new THREE.MeshLambertMaterial({color:c}); }

function box(w,h,d,x,y,z,color,o){
  o = o || {};
  const mat = o.map ? new THREE.MeshLambertMaterial({map:o.map})
           : o.basic ? new THREE.MeshBasicMaterial({color:color})
           : lam(color);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z);
  m.castShadow = !o.noShadow;
  m.receiveShadow = !o.noShadow;
  (o.parent||root).add(m);
  return m;
}

function cyl(rt,rb,h,seg,x,y,z,color,parent,o){
  o = o || {};
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rt,rb,h,seg),
    lam(color)
  );
  m.position.set(x,y,z);
  m.castShadow = !o.noShadow;
  m.receiveShadow = !o.noShadow;
  (parent||root).add(m);
  return m;
}

function roundRect(g, x, y, w, h, r){
  g.beginPath();
  g.moveTo(x+r, y);
  g.lineTo(x+w-r, y);
  g.quadraticCurveTo(x+w, y, x+w, y+r);
  g.lineTo(x+w, y+h-r);
  g.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  g.lineTo(x+r, y+h);
  g.quadraticCurveTo(x, y+h, x, y+h-r);
  g.lineTo(x, y+r);
  g.quadraticCurveTo(x, y, x+r, y);
  g.closePath();
}

function makeLabel(text, x, y, z, parent){
  const FS = 30, PADX = 22, PADY = 12;
  const c = document.createElement('canvas');
  const ctx0 = c.getContext('2d');
  ctx0.font = '800 '+FS+'px "Inter","Helvetica Neue",Arial,sans-serif';
  const tw = ctx0.measureText(text).width;
  c.width  = Math.ceil(tw + PADX*2);
  c.height = FS + PADY*2;

  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  roundRect(g, 2, 2, c.width-4, c.height-4, c.height/2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.10)';
  g.lineWidth = 1.5;
  roundRect(g, 2, 2, c.width-4, c.height-4, c.height/2);
  g.stroke();

  g.fillStyle = '#0a0a0a';
  g.font = '800 '+FS+'px "Inter","Helvetica Neue",Arial,sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width/2, c.height/2 + 1);

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;

  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent:true, depthTest:false, depthWrite:false,
    sizeAttenuation:false
  }));
  const H = 0.026;
  const W = H * (c.width / c.height);
  spr.scale.set(W, H, 1);
  spr.userData.base = {w:W, h:H};
  spr.position.set(x,y,z);
  (parent||root).add(spr);
  labels.push(spr);
}

function numBadge(n, x, y, z, parent){
  const S = 96;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a0a';
  g.beginPath();
  g.arc(S/2, S/2, S/2 - 8, 0, 6.283);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = '800 '+Math.round(S*0.50)+'px "Inter","Helvetica Neue",Arial,sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(n, S/2, S/2 + 1);

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.anisotropy = 4;

  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent:true, depthTest:false, depthWrite:false,
    sizeAttenuation:false
  }));
  const size = 0.026;
  spr.scale.set(size, size, 1);
  spr.userData.base = {w:size, h:size};
  spr.position.set(x,y,z);
  (parent||root).add(spr);
  labels.push(spr);
}

/* ---------- Suelo ---------- */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.ShadowMaterial({opacity:0.11})
);
ground.rotation.x = -Math.PI/2;
ground.position.y = 0.02;
ground.receiveShadow = true;
root.add(ground);

/* ---------- Estructura de la mesa ---------- */
box(100, 2.0, 60, 0, TY-1.0, 0, MDF_TOP);
box(2.0, TY-2.0, 50, -47, (TY-2.0)/2, 0, MDF_SIDE);
box(2.0, TY-2.0, 50,  47, (TY-2.0)/2, 0, MDF_SIDE);
box(92.5, 1.8, 45, 0, 22, 0, MDF_SIDE);

[[-47,-22],[-47,22],[47,-22],[47,22]].forEach(function(p){
  box(3.6, 1.6, 3.6, p[0], 0.8, p[1], DARK, {noShadow:true});
});

/* ---------- CPU / PC de escritorio (entrepaño inferior) ---------- */
box(14, 18, 22, -20, 32, 2, DARK_2, {});
box(12, 16, 0.3, -20, 32, 13.2, 0x1a1d21, {noShadow:true});
box(8, 6, 0.4, -20, 27, 13.3, 0x2a2d32, {noShadow:true});
box(1.2, 1.2, 0.3, -16, 38, 13.3, GREEN, {basic:true, noShadow:true});
box(3, 0.6, 0.3, -20, 36, 13.3, 0x333639, {noShadow:true});
box(3, 0.6, 0.3, -20, 34.5, 13.3, 0x333639, {noShadow:true});
makeLabel(CFG.labels.cpu, -20, 48, 2);

/* ---------- Fuente 5V (entrepaño inferior) ---------- */
box(11, 5, 6, 22, 25.4, 2, DARK, {});
makeLabel(CFG.labels.fuente, 22, 36, 2);

/* ---------- Pórtico ---------- */
box(8, 50, 2.0, -44, TY+25, -27, MDF_SIDE);
box(8, 50, 2.0,  44, TY+25, -27, MDF_SIDE);
box(100, 8, 2.0, 0, TY+47, -25.5, MDF_TOP);

[-44, 44].forEach(function(px){
  box(6, 6, 0.6, px, TY+3, -26.1, METAL, {noShadow:true});
  box(6, 0.6, 6, px, TY+0.3, -23.4, METAL, {noShadow:true});
});

/* ---------- Franja Andon ---------- */
const andonStrip = box(96, 2.0, 0.4, 0, TY+47, -24.4, GREEN, {basic:true, noShadow:true});
box(90, 0.5, 2.2, 0, TY+43, -25.5, 0xfaf6ea, {basic:true, noShadow:true});
makeLabel(CFG.labels.andon, 0, TY+58, -24.4);

cyl(1.5, 1.5, 1.8, 24, 46, TY+35, -25.7, 0x1c1c1c, root, {}).rotation.x = Math.PI/2;
makeLabel(CFG.labels.buzzer, 58, TY+35, -25.7);

/* ---------- Brazo + cámara sobre el nido ---------- */
// Barra horizontal que sale desde la viga hacia el frente, sobre el nido
// (nace embebida en la viga — no se necesita pieza vertical extra)
box(4, 1.8, 34, 0, TY+43, -9, MDF_DARK);
// Cuerpo de la cámara al final de la barra
box(9, 3.2, 3.2, 0, TY+41, 8, DARK, {});
// Lente de la cámara (apuntando hacia abajo)
const camLens = cyl(1.2, 1.0, 1.0, 20, 0, TY+39, 8, 0x1a3a5c, root, {});
camLens.castShadow = false;
makeLabel(CFG.labels.camara, 0, TY+34, 8);

/* ---------- Monitor ---------- */
box(5, 12, 5, -34, TY+6, -32, DARK, {});
box(3, 3, 20, -34, TY+14, -25, 0x333333, {});
box(52, 32, 3.0, -34, TY+27, -20, DARK_2, {});

const mc = document.createElement('canvas'); mc.width = 700; mc.height = 420;
const mx = mc.getContext('2d');
mx.fillStyle = '#0d1116'; mx.fillRect(0,0,700,420);
mx.fillStyle = '#8fb4d9'; mx.font = '700 20px "Inter",sans-serif';
mx.fillText(CFG.monitorTexts.title, 22, 34);
mx.fillStyle = '#2f343a'; mx.fillRect(130, 64, 440, 260);
mx.fillStyle = '#e6dfcf'; mx.fillRect(170, 96, 360, 196);
function hexShape(g, cx, cy, rad){
  g.beginPath();
  for(let i=0;i<6;i++){ const a = i*Math.PI/3; g.lineTo(cx+rad*Math.cos(a), cy+rad*Math.sin(a)); }
  g.closePath(); g.fillStyle = '#55554f'; g.fill();
}
hexShape(mx, 280, 194, 40); hexShape(mx, 420, 194, 40);
mx.strokeStyle = '#34c759'; mx.lineWidth = 5; mx.strokeRect(232, 146, 96, 96);
mx.fillStyle = '#34c759'; mx.font = '800 22px "Inter",sans-serif';
mx.fillText(CFG.monitorTexts.partLabel, 234, 138);
mx.fillStyle = '#8fb4d9'; mx.font = '600 18px "Inter",sans-serif';
mx.fillText(CFG.monitorTexts.stepInfo, 22, 388);

const scr = new THREE.Mesh(
  new THREE.PlaneGeometry(49, 29.4),
  new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(mc)})
);
scr.position.set(-34, TY+27, -18.4);
root.add(scr);
makeLabel(CFG.labels.monitor, -34, TY+50, -22);

/* ---------- Nido de ensamble (centro) ---------- */
box(22, 1.6, 16, 0, TY+0.8, 6, 0xeee4cd);
[-6, 6].forEach(function(hx){ cyl(3.4, 3.4, 0.7, 6, hx, TY+2.0, 6, 0x4a4a44); });
box(4.5, 0.7, 4.5, 0, TY+2.0, 10, 0x4a4a44, {noShadow:true});
makeLabel(CFG.labels.nido, 0, TY+10, 6);

/* ---------- Lector RFID (frente derecha) ---------- */
box(6, 1.0, 4, 14, TY+0.5, 20, ACCENT, {noShadow:true});
makeLabel(CFG.labels.rfid, 14, TY+9, 20);

/* ---------- Herramientas (frente izquierda) ---------- */
box(20, 2.4, 8, -22, TY+1.2, 20, MDF_SIDE);
cyl(1, 1, 14, 18, -26, TY+9.4, 20, 0x33363a);
cyl(1, 1, 14, 18, -18, TY+9.4, 20, 0xc0392b);
box(2.5, 0.5, 2.5, -22, TY+2.7, 24, ACCENT, {noShadow:true});
makeLabel(CFG.labels.herramientas, -22, TY+23, 20);

/* ---------- Poste + cableado ---------- */
(function(){
  const pts = [
    new THREE.Vector3(50, TY+3, 18),
    new THREE.Vector3(51.5, TY+11, 18),
    new THREE.Vector3(50, TY+20, 18),
    new THREE.Vector3(46, TY+28, 17.5)
  ];
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.6, 10, false),
    lam(0x2c2c2c)
  );
  tube.castShadow = true;
  root.add(tube);
})();
box(3, 6, 5, 50, TY, 18, DARK, {});

/* ---------- Caja ESP32 ---------- */
box(12, 4.5, 8, 40, TY+2.25, 12, 0x1f2933, {});
cyl(0.4, 0.4, 3.5, 8, 42, TY+6.5, 12, METAL_D, root, {});
makeLabel(CFG.labels.esp32, 40, TY+12, 12);

/* ---------- Tablet HMI (montada en la punta del poste) ---------- */
// Abrazadera en la punta del poste (detrás de la tablet para no atravesarla)
box(3, 2.5, 2, 46, TY+29, 16, METAL_D, {noShadow:true});
// Tablet montada en la punta
const tab = new THREE.Group();
tab.position.set(46, TY+30.5, 17.5);
tab.rotation.x = -0.20;
tab.rotation.y = -0.40;
root.add(tab);
box(25, 17, 1.1, 0, 0, 0, DARK_2, {parent:tab});

const tc = document.createElement('canvas'); tc.width = 480; tc.height = 320;
const t = tc.getContext('2d');
t.fillStyle = '#0f1720'; t.fillRect(0,0,480,320);
t.fillStyle = '#8fb4d9'; t.font = '700 18px "Inter",sans-serif';
t.fillText(CFG.tabletTexts.step, 24, 42);
t.fillStyle = '#ffffff'; t.font = '800 32px "Inter",sans-serif';
t.fillText(CFG.tabletTexts.action, 24, 96);
t.font = '600 19px "Inter",sans-serif'; t.fillStyle = '#c9d6e3';
t.fillText(CFG.tabletTexts.hint, 24, 134);
t.fillStyle = '#2c3743'; t.fillRect(24, 166, 432, 12);
t.fillStyle = '#34c759'; t.fillRect(24, 166, 162, 12);
t.fillStyle = '#22303d'; t.fillRect(24, 210, 200, 60); t.fillRect(240, 210, 216, 60);
t.fillStyle = '#e8eef5'; t.font = '700 22px "Inter",sans-serif';
t.fillText(CFG.tabletTexts.btnPause, 76, 246);
t.fillText(CFG.tabletTexts.btnAndon, 268, 246);

const tp = new THREE.Mesh(
  new THREE.PlaneGeometry(23, 15.4),
  new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(tc)})
);
tp.position.z = 0.6;
tab.add(tp);
makeLabel(CFG.labels.tablet, 46, TY+44, 17.5);

/* ============================================================
   BANDEJAS DE BINS
   ============================================================ */
function tray(cx, names, start){
  const g = new THREE.Group();
  g.position.set(cx, TY+0.7, -12);
  root.add(g);

  const W = 38, D = 14;
  box(W, 1.4, D, 0, 0, 0, MDF_TOP, {parent:g});
  box(W-2, 0.45, 0.7, 0, 0.85, D/2 + 0.1, GREEN, {parent:g, basic:true, noShadow:true});

  const spacing = 9.2;
  for(let i=0;i<names.length;i++){
    const lx = (i - 1.5) * spacing;
    box(8, 6.2, 11, lx, 3.9, 0, BIN_BG, {parent:g});
    box(6.4, 0.35, 9.4, lx, 7.05, 0, BIN_IN, {parent:g, noShadow:true});
    box(2.4, 1.7, 1, lx, 2.1, D/2 - 0.9, DARK_2, {parent:g, noShadow:true});
    numBadge(String(start+i), lx, 14, 0, g);
  }
}
tray(-30, ['a','b','c','d'], 1);
tray( 30, ['e','f','g','h'], 5);

/* ============================================================
   CÁMARA ORBITAL
   ============================================================ */
let th = 0.55, ph = 0.24, r = 315;
const tgt = new THREE.Vector3(0, 72, 0);

function clampR(v){ return Math.max(50, Math.min(700, v)); }
function fitK(){
  const a = cam.aspect || 1;
  return a >= 1 ? 1 : Math.min(1.95, 1/a);
}
function upd(){
  const rr = r * fitK();
  cam.position.set(
    tgt.x + rr*Math.sin(th)*Math.cos(ph),
    tgt.y + rr*Math.sin(ph),
    tgt.z + rr*Math.cos(th)*Math.cos(ph)
  );
  cam.lookAt(tgt);
  renderer.render(scene, cam);
}
function panBy(dx, dy){
  const k = r * 0.0016;
  tgt.x -= dx * Math.cos(th) * k;
  tgt.z += dx * Math.sin(th) * k;
  tgt.y = Math.max(0, Math.min(160, tgt.y + dy * k));
}

const VIEWS = {
  gen:   [0, 72, 0,   0.55, 0.24, 315],
  work:  [0, 78, 2,   0.30, 0.52, 150],
  scr:   [0, 92, -12, 0.10, 0.22, 185],
  under: [0, 36, 0,   0.22, 0.14, 172],
  top:   [0, 76, 0,   0.00, 1.30, 210],
  /* Vista isométrica tipo SolidWorks: ángulo ~35.26° elevación, ~45° azimut */
  iso:   [0, 72, 0,   0.7854, 0.6155, 320]
};
function view(k){
  const p = VIEWS[k] || VIEWS.gen;
  tgt.set(p[0], p[1], p[2]);
  th = p[3]; ph = p[4]; r = p[5];
  upd();
}
function zoom(f){ r = clampR(r*f); upd(); }
function andon(c){ andonStrip.material.color.setHex(c); upd(); }

window.view = view; window.zoom = zoom; window.andon = andon;

/* ---------- Tecla F → Vista isométrica ---------- */
document.addEventListener('keydown', function(e){
  if(e.key === 'f' || e.key === 'F'){
    // No activar si se está escribiendo en un input
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    view('iso');
    // Marcar botón activo
    document.querySelectorAll('[data-view]').forEach(function(o){ o.classList.remove('active'); });
  }
});

/* ---------- Interacción ---------- */
const el = renderer.domElement;
const ptrs = new Map();
let pinch = null;

function pinchState(){
  const ids = Array.from(ptrs.keys());
  const a = ptrs.get(ids[0]), b = ptrs.get(ids[1]);
  return {
    dist: Math.hypot(a.x-b.x, a.y-b.y),
    cx: (a.x+b.x)/2,
    cy: (a.y+b.y)/2
  };
}

el.addEventListener('contextmenu', function(e){ e.preventDefault(); });

el.addEventListener('pointerdown', function(e){
  e.preventDefault();
  try{ el.setPointerCapture(e.pointerId); }catch(err){}
  ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
  wrap.classList.add('grabbing');
  pinch = ptrs.size === 2 ? pinchState() : null;
});

el.addEventListener('pointermove', function(e){
  const p = ptrs.get(e.pointerId);
  if(!p) return;

  if(ptrs.size >= 2){
    p.x = e.clientX; p.y = e.clientY;
    const st = pinchState();
    if(pinch){
      if(st.dist > 0 && pinch.dist > 0){ r = clampR(r * (pinch.dist / st.dist)); }
      panBy(st.cx - pinch.cx, st.cy - pinch.cy);
    }
    pinch = st;
    upd();
    return;
  }

  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;

  if(e.shiftKey || e.buttons === 2){
    panBy(dx, dy);
  } else {
    th -= dx * 0.0075;
    ph = Math.max(0.02, Math.min(1.45, ph + dy * 0.0055));
  }
  upd();
});

function release(e){
  ptrs.delete(e.pointerId);
  if(ptrs.size < 2) pinch = null;
  if(ptrs.size === 0) wrap.classList.remove('grabbing');
}
el.addEventListener('pointerup', release);
el.addEventListener('pointercancel', release);
el.addEventListener('lostpointercapture', release);

el.addEventListener('wheel', function(e){
  e.preventDefault();
  r = clampR(r * (e.deltaY > 0 ? 1.1 : 0.9));
  upd();
}, {passive:false});

['gesturestart','gesturechange','gestureend'].forEach(function(t){
  el.addEventListener(t, function(e){ e.preventDefault(); }, {passive:false});
});

/* ---------- Botones ---------- */
document.querySelectorAll('[data-view]').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('[data-view]').forEach(function(o){ o.classList.remove('active'); });
    b.classList.add('active');
    view(b.dataset.view);
  });
});
document.querySelectorAll('[data-zoom]').forEach(function(b){
  b.addEventListener('click', function(){ zoom(parseFloat(b.dataset.zoom)); });
});
document.querySelectorAll('[data-andon]').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('[data-andon]').forEach(function(o){ o.classList.remove('active'); });
    b.classList.add('active');
    andon(parseInt(b.dataset.andon, 16));
  });
});

let labelsOn = true;
document.getElementById('lblBtn').addEventListener('click', function(e){
  labelsOn = !labelsOn;
  e.currentTarget.classList.toggle('active', labelsOn);
  labels.forEach(function(s){ s.visible = labelsOn; });
  upd();
});

/* ---------- Responsive ---------- */
function resize(){
  const w = Math.max(1, wrap.clientWidth);
  const h = Math.max(1, wrap.clientHeight);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  cam.aspect = w / h;
  cam.updateProjectionMatrix();

  const k = w < 480 ? 0.78 : (w < 760 ? 0.9 : 1);
  labels.forEach(function(s){
    const b = s.userData.base;
    s.scale.set(b.w * k, b.h * k, 1);
  });
  upd();
}

if(window.ResizeObserver){
  new ResizeObserver(resize).observe(wrap);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', function(){ setTimeout(resize, 250); });

resize();
})();
