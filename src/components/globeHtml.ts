import { getContinentColor } from '../data/continents';
import { getMapLabel } from '../data/countryLabels';
import { COUNTRY_GEOMETRY } from '../data/worldGlobeGeometry';
import { getCountry } from '../data/worldCountryPaths';
import { colors } from '../theme/colors';

/**
 * Küre, WebView içindeki bir <canvas> üzerinde çiziliyor.
 *
 * Neden: react-native-svg her değişiklikte tüm vektör ağacını yeniden
 * rasterleştiriyor; 5.000 noktalık bir küreyi 60 kare/sn döndürmek ne JS
 * thread'inde ne de UI thread'inde yetişiyordu. Canvas ise donanım
 * hızlandırmalı ve WebView kendi thread'inde çalıştığı için döndürme
 * uygulamanın hiçbir thread'ini meşgul etmiyor: parmak hareketi, atalet ve
 * çizim tamamen sayfanın içinde kalıyor. React Native'e sadece "hazırım" ve
 * "şu ülke seçildi" mesajları geliyor.
 *
 * Geometri (enlem/boylam halkaları) sayfaya bir kez gömülüyor — açılışta
 * görünen "harita hazırlanıyor" adımı bu.
 */

interface GlobePayload {
  countries: {
    code: string;
    label: string;
    color: string;
    rings: number[][];
    coarse: number[][];
    centroid: [number, number];
    labelSpan: number;
  }[];
  initial: { lon: number; lat: number };
}

function buildPayload(): GlobePayload {
  return {
    countries: COUNTRY_GEOMETRY.map((geometry) => {
      const country = getCountry(geometry.code);
      return {
        code: geometry.code,
        label: country ? getMapLabel(geometry.code, country.name) : geometry.code,
        color: country ? getContinentColor(country.continent) : colors.mapUnconquered,
        rings: geometry.rings,
        coarse: geometry.coarseRings,
        centroid: geometry.centroid,
        labelSpan: geometry.labelSpan,
      };
    }),
    // Açılışta Türkiye ortada.
    initial: { lon: 35, lat: 39 },
  };
}

// Sayfanın betiği. Şablon değişkeni kullanmıyor (gömülü JSON dışında), böylece
// buradaki JS ile TypeScript şablon dizesi birbirine karışmıyor.
const GLOBE_SCRIPT = String.raw`
(function () {
  var D = window.__GLOBE__;
  var DEG = Math.PI / 180;
  var MAX_PHI = 78 * DEG;
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 2.8;
  var DRAG_GAIN = 1;
  // Bırakınca dönüşün her karede kalan hız oranı ve durma eşiği.
  var SPIN_FRICTION = 0.94;
  var SPIN_STOP = 0.00015;
  var TAP_SLOP = 12;
  var TAP_MS = 400;
  var LABEL_MIN_FACING = 0.32;
  var LABEL_MIN_FONT = 8;
  var LABEL_MAX_FONT = 15;
  var NEAR_MISS_DEGREES = 2.2;

  var canvas = document.getElementById('globe');
  var ctx = canvas.getContext('2d');

  var W = 0, H = 0;
  var lambda = D.initial.lon * DEG;
  var phi = D.initial.lat * DEG;
  var zoom = 1;
  var owners = {};
  var moving = false;
  var dirty = true;

  // ---- geometri hazırlığı (bir kez) ----------------------------------------

  function unit(lon, lat) {
    var l = lon * DEG, p = lat * DEG, cp = Math.cos(p);
    return [cp * Math.sin(l), Math.sin(p), cp * Math.cos(l)];
  }

  function toVectors(flat) {
    var out = new Float32Array((flat.length / 2) * 3);
    for (var i = 0, j = 0; i < flat.length; i += 2, j += 3) {
      var v = unit(flat[i], flat[i + 1]);
      out[j] = v[0]; out[j + 1] = v[1]; out[j + 2] = v[2];
    }
    return out;
  }

  // Işın atma için halkalar: 180. meridyeni geçenler 0..360'a kaydırılır.
  function pickRing(flat) {
    var minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity, i;
    for (i = 0; i < flat.length; i += 2) {
      if (flat[i] < minLon) minLon = flat[i];
      if (flat[i] > maxLon) maxLon = flat[i];
      if (flat[i + 1] < minLat) minLat = flat[i + 1];
      if (flat[i + 1] > maxLat) maxLat = flat[i + 1];
    }
    if (maxLon - minLon > 180) {
      var shifted = flat.slice();
      minLon = Infinity; maxLon = -Infinity;
      for (i = 0; i < shifted.length; i += 2) {
        if (shifted[i] < 0) shifted[i] += 360;
        if (shifted[i] < minLon) minLon = shifted[i];
        if (shifted[i] > maxLon) maxLon = shifted[i];
      }
      return { p: shifted, minLon: minLon, maxLon: maxLon, minLat: minLat, maxLat: maxLat, shifted: true };
    }
    return { p: flat, minLon: minLon, maxLon: maxLon, minLat: minLat, maxLat: maxLat, shifted: false };
  }

  var C = D.countries.map(function (c) {
    var fine = c.rings.map(toVectors);
    var coarse = c.coarse.map(toVectors);
    var centroid = unit(c.centroid[0], c.centroid[1]);
    var minDot = 1;
    for (var r = 0; r < fine.length; r++) {
      var ring = fine[r];
      for (var i = 0; i < ring.length; i += 3) {
        var dot = centroid[0] * ring[i] + centroid[1] * ring[i + 1] + centroid[2] * ring[i + 2];
        if (dot < minDot) minDot = dot;
      }
    }
    var maxAngle = Math.acos(Math.max(-1, Math.min(1, minDot)));
    return {
      code: c.code,
      label: c.label,
      color: c.color,
      fine: fine,
      coarse: coarse,
      centroid: centroid,
      hideBelow: maxAngle >= Math.PI / 2 ? -1 : -Math.sin(maxAngle),
      labelSpan: c.labelSpan,
      pickRings: c.rings.map(pickRing),
      coarseFlat: c.coarse
    };
  });

  var GRATICULE = (function () {
    var lines = [], lon, lat, flat;
    for (lon = -180; lon < 180; lon += 45) {
      flat = [];
      for (lat = -80; lat <= 80; lat += 10) flat.push(lon, lat);
      lines.push(toVectors(flat));
    }
    for (lat = -60; lat <= 60; lat += 30) {
      flat = [];
      for (lon = -180; lon <= 180; lon += 10) flat.push(lon, lat);
      lines.push(toVectors(flat));
    }
    return lines;
  })();

  // ---- çizim ---------------------------------------------------------------

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }

  function radius() { return Math.min(W, H) * 0.44 * zoom; }

  function shade(hex, percent) {
    var num = parseInt(hex.slice(1), 16);
    var amt = Math.round(2.55 * percent);
    function cl(v) { return Math.max(0, Math.min(255, v)); }
    var r = cl((num >> 16) + amt), g = cl(((num >> 8) & 255) + amt), b = cl((num & 255) + amt);
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  }

  var strokeCache = {};
  function strokeFor(fill) {
    if (!strokeCache[fill]) strokeCache[fill] = shade(fill, -35);
    return strokeCache[fill];
  }

  function draw() {
    var R = radius(), cx = W / 2, cy = H / 2;

    // Zemin saydam: kürenin arkasında ekranın kendi arka planı kalır.
    ctx.clearRect(0, 0, W, H);

    // Atmosfer halesi.
    var halo = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.14);
    halo.addColorStop(0, 'rgba(191,233,255,0.28)');
    halo.addColorStop(1, 'rgba(191,233,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2);
    ctx.fill();

    // Okyanus.
    var ocean = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.44, R * 0.1, cx, cy, R);
    ocean.addColorStop(0, '#57AFD0');
    ocean.addColorStop(0.65, '#2979A6');
    ocean.addColorStop(1, '#123F62');
    ctx.fillStyle = ocean;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    var cosL = Math.cos(lambda), sinL = Math.sin(lambda);
    var cosP = Math.cos(phi), sinP = Math.sin(phi);

    // Meridyen/paralel telleri (durgunken).
    if (!moving) {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (var g = 0; g < GRATICULE.length; g++) {
        var line = GRATICULE[g], drawing = false;
        for (var li = 0; li < line.length; li += 3) {
          var lx1 = line[li] * cosL - line[li + 2] * sinL;
          var lz1 = line[li] * sinL + line[li + 2] * cosL;
          var ly2 = line[li + 1] * cosP - lz1 * sinP;
          var lz2 = line[li + 1] * sinP + lz1 * cosP;
          if (lz2 <= 0) { drawing = false; continue; }
          var lpx = cx + R * lx1, lpy = cy - R * ly2;
          if (drawing) ctx.lineTo(lpx, lpy); else ctx.moveTo(lpx, lpy);
          drawing = true;
        }
      }
      ctx.stroke();
    }

    // Ülkeler renk gruplarına toplanır: aynı renk tek fill + tek stroke.
    var groups = {}, order = [];
    for (var c = 0; c < C.length; c++) {
      var country = C[c];
      var q = country.centroid;
      var qz1 = q[0] * sinL + q[2] * cosL;
      var qz2 = q[1] * sinP + qz1 * cosP;
      if (qz2 < country.hideBelow) continue;
      var fill = owners[country.code] || country.color;
      if (!groups[fill]) { groups[fill] = []; order.push(fill); }
      groups[fill].push(country);
    }

    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.8;

    for (var o = 0; o < order.length; o++) {
      var color = order[o], list = groups[color];
      ctx.beginPath();
      for (var k = 0; k < list.length; k++) {
        var rings = moving ? list[k].coarse : list[k].fine;
        for (var ri = 0; ri < rings.length; ri++) {
          var ring = rings[ri], visible = 0, started = false;
          for (var i = 0; i < ring.length; i += 3) {
            var x1 = ring[i] * cosL - ring[i + 2] * sinL;
            var z1 = ring[i] * sinL + ring[i + 2] * cosL;
            var y2 = ring[i + 1] * cosP - z1 * sinP;
            var z2 = ring[i + 1] * sinP + z1 * cosP;
            var px, py;
            if (z2 > 0) {
              visible++;
              px = cx + R * x1; py = cy - R * y2;
            } else {
              // Arka yüzdeki noktalar kürenin kenarına yapıştırılır.
              var m = Math.sqrt(x1 * x1 + y2 * y2) || 1;
              px = cx + (R * x1) / m; py = cy - (R * y2) / m;
            }
            if (started) ctx.lineTo(px, py); else { ctx.moveTo(px, py); started = true; }
          }
          if (started) ctx.closePath();
        }
      }
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = strokeFor(color);
      ctx.stroke();
    }

    // Kenar gölgesi: küreye hacim verir.
    var shadeGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.44, R * 0.2, cx, cy, R);
    shadeGrad.addColorStop(0.5, 'rgba(8,32,58,0)');
    shadeGrad.addColorStop(1, 'rgba(8,32,58,0.55)');
    ctx.fillStyle = shadeGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // Ülke adları (durgunken).
    if (!moving) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (var n = 0; n < C.length; n++) {
        var ct = C[n], v = ct.centroid;
        var vx1 = v[0] * cosL - v[2] * sinL;
        var vz1 = v[0] * sinL + v[2] * cosL;
        var vy2 = v[1] * cosP - vz1 * sinP;
        var vz2 = v[1] * sinP + vz1 * cosP;
        if (vz2 <= LABEL_MIN_FACING) continue;
        var fontSize = Math.max(LABEL_MIN_FONT, Math.min(LABEL_MAX_FONT, R * 0.055 * vz2));
        ctx.font = '700 ' + fontSize.toFixed(1) + 'px system-ui, -apple-system, Roboto, sans-serif';
        // Ülkenin ekrandaki genişliği: kenara ve kutuplara doğru daralır.
        var span = ct.labelSpan * DEG * R * vz2;
        if (ctx.measureText(ct.label).width > span * 0.95) continue;
        var tx = cx + R * vx1, ty = cy - R * vy2;
        ctx.lineWidth = Math.max(1.5, fontSize * 0.22);
        ctx.strokeStyle = 'rgba(11,27,46,0.85)';
        ctx.strokeText(ct.label, tx, ty);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(ct.label, tx, ty);
      }
    }
  }

  // ---- döngü ---------------------------------------------------------------

  var spinL = 0, spinP = 0, spinning = false;

  function frame() {
    if (spinning) {
      lambda += spinL;
      phi = Math.max(-MAX_PHI, Math.min(MAX_PHI, phi + spinP));
      if (phi <= -MAX_PHI || phi >= MAX_PHI) spinP = 0;
      spinL *= SPIN_FRICTION;
      spinP *= SPIN_FRICTION;
      if (Math.abs(spinL) < SPIN_STOP && Math.abs(spinP) < SPIN_STOP) {
        spinning = false;
        moving = false;
      }
      dirty = true;
    }
    if (dirty) { dirty = false; draw(); }
    requestAnimationFrame(frame);
  }

  // ---- dokunma -------------------------------------------------------------

  function unproject(px, py) {
    var R = radius(), cx = W / 2, cy = H / 2;
    var x = (px - cx) / R, y = -(py - cy) / R;
    var rr = x * x + y * y;
    if (rr > 1) return null;
    var z = Math.sqrt(1 - rr);
    var cosP = Math.cos(phi), sinP = Math.sin(phi);
    var y1 = y * cosP + z * sinP;
    var z1 = -y * sinP + z * cosP;
    var cosL = Math.cos(lambda), sinL = Math.sin(lambda);
    var x0 = x * cosL + z1 * sinL;
    var z0 = -x * sinL + z1 * cosL;
    return { lon: Math.atan2(x0, z0) / DEG, lat: Math.asin(Math.max(-1, Math.min(1, y1))) / DEG };
  }

  function ringContains(ring, lon, lat) {
    var x = ring.shifted && lon < 0 ? lon + 360 : lon;
    if (x < ring.minLon || x > ring.maxLon || lat < ring.minLat || lat > ring.maxLat) return false;
    var p = ring.p, inside = false;
    for (var i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      var xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
      if ((yi > lat) !== (yj > lat) && x < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function pick(lon, lat) {
    var i, j;
    for (i = 0; i < C.length; i++) {
      // Halkalar tek/çift sayılır: Güney Afrika içindeki Lesotho deliği
      // çift sayılıp doğru ülkeye gider.
      var crossings = 0;
      for (j = 0; j < C[i].pickRings.length; j++) {
        if (ringContains(C[i].pickRings[j], lon, lat)) crossings++;
      }
      if (crossings % 2 === 1) return C[i].code;
    }
    // Yakın ıska: küçük ülkelere ve kıyılara dokunmayı bağışlayıcı yapar.
    var cosLat = Math.cos(lat * DEG), best = null, bestD = NEAR_MISS_DEGREES;
    for (i = 0; i < C.length; i++) {
      var flats = C[i].coarseFlat;
      for (j = 0; j < flats.length; j++) {
        var ring = flats[j];
        for (var k = 0; k < ring.length; k += 2) {
          var dLon = ring[k] - lon;
          if (dLon > 180) dLon -= 360; else if (dLon < -180) dLon += 360;
          var dx = dLon * cosLat, dy = ring[k + 1] - lat;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < bestD) { bestD = d; best = C[i].code; }
        }
      }
    }
    return best;
  }

  function send(message) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }

  var touch = null;
  var pinch = null;

  function touchPos(t) { return { x: t.clientX, y: t.clientY }; }

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      var a = touchPos(e.touches[0]), b = touchPos(e.touches[1]);
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoom };
      touch = null;
      moving = true;
      return;
    }
    var wasSpinning = spinning;
    spinning = false;
    spinL = 0; spinP = 0;
    var p = touchPos(e.touches[0]);
    touch = {
      x: p.x, y: p.y, lambda: lambda, phi: phi,
      startX: p.x, startY: p.y, time: Date.now(),
      lastX: p.x, lastY: p.y, lastTime: Date.now(),
      vx: 0, vy: 0, moved: 0, wasSpinning: wasSpinning
    };
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (pinch && e.touches.length === 2) {
      var a = touchPos(e.touches[0]), b = touchPos(e.touches[1]);
      var distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.distance > 0) {
        zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinch.zoom * (distance / pinch.distance)));
        dirty = true;
      }
      return;
    }
    if (!touch) return;
    var p = touchPos(e.touches[0]);
    var gain = DRAG_GAIN / radius();
    var dx = p.x - touch.startX, dy = p.y - touch.startY;
    touch.moved = Math.max(touch.moved, Math.hypot(dx, dy));
    if (touch.moved > TAP_SLOP) moving = true;
    // Parmak sağa giderse küre sağa döner: bakılan boylam batıya kayar.
    lambda = touch.lambda - dx * gain;
    phi = Math.max(-MAX_PHI, Math.min(MAX_PHI, touch.phi + dy * gain));

    var now = Date.now(), dt = now - touch.lastTime;
    if (dt > 0) {
      touch.vx = (p.x - touch.lastX) / dt;
      touch.vy = (p.y - touch.lastY) / dt;
      touch.lastX = p.x; touch.lastY = p.y; touch.lastTime = now;
    }
    dirty = true;
  }, { passive: false });

  function endTouch(e) {
    if (pinch && e.touches.length < 2) {
      pinch = null;
      moving = false;
      dirty = true;
    }
    if (!touch) return;
    var t = touch;
    touch = null;

    var quick = Date.now() - t.time < TAP_MS;
    if (t.moved <= TAP_SLOP && quick) {
      moving = false;
      dirty = true;
      // Dönen küreyi durduran dokunuş ülke seçimi sayılmaz.
      if (!t.wasSpinning) {
        var point = unproject(t.startX, t.startY);
        if (point) {
          var code = pick(point.lon, point.lat);
          if (code) send({ type: 'select', code: code });
        }
      }
      return;
    }

    // Atalet: son ölçülen hız kare başına açıya çevrilir.
    var gain = DRAG_GAIN / radius();
    var idle = Date.now() - t.lastTime;
    if (idle > 120) { moving = false; dirty = true; return; }
    spinL = -t.vx * gain * 16;
    spinP = t.vy * gain * 16;
    var speed = Math.abs(spinL) + Math.abs(spinP);
    if (speed < SPIN_STOP) { moving = false; dirty = true; return; }
    var cap = 0.12;
    if (speed > cap) { spinL *= cap / speed; spinP *= cap / speed; }
    spinning = true;
    moving = true;
  }

  canvas.addEventListener('touchend', function (e) { e.preventDefault(); endTouch(e); }, { passive: false });
  canvas.addEventListener('touchcancel', function (e) { endTouch(e); }, { passive: false });

  window.addEventListener('resize', resize);

  window.__setOwners = function (next) {
    owners = next || {};
    dirty = true;
  };

  resize();
  draw();
  requestAnimationFrame(frame);
  send({ type: 'ready' });
})();
`;

/** Küre sayfasını (veri gömülü) üretir. Ağır iş burada: JSON serileştirme. */
export function buildGlobeHtml(): string {
  // </script> ve < karakterleri gömülü JSON'da sayfayı bozmasın.
  const payload = JSON.stringify(buildPayload()).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<style>
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: transparent; }
  canvas { display: block; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
</style>
</head>
<body>
<canvas id="globe"></canvas>
<script>window.__GLOBE__ = ${payload};</script>
<script>${GLOBE_SCRIPT}</script>
</body>
</html>`;
}
