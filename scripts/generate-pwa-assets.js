import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const iconSvgPath = path.join(publicDir, 'icon.svg');
const svgBuffer = fs.readFileSync(iconSvgPath);

async function generateAssets() {
  console.log('Generating PWA Icons & Screenshots...');

  // 1. pwa-192x192.png
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 2. pwa-512x512.png
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 3. apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 4. pwa-maskable-512x512.png (512x512 with safe padding)
  const innerResized = await sharp(svgBuffer)
    .resize(380, 380, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
  })
    .composite([{ input: innerResized, top: 66, left: 66 }])
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // 5. screenshot-narrow.png (720x1280) mobile preview screenshot
  const narrowSvg = `
  <svg width="720" height="1280" viewBox="0 0 720 1280" xmlns="http://www.w3.org/2000/svg">
    <rect width="720" height="1280" fill="#020617"/>
    <!-- Top Bar -->
    <rect x="0" y="0" width="720" height="80" fill="#0f172a"/>
    <text x="36" y="50" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="#f59e0b">BIKEREADY WORKSHOP OS</text>
    <rect x="520" y="24" width="164" height="36" rx="18" fill="#f59e0b"/>
    <text x="602" y="48" font-family="system-ui, sans-serif" font-weight="700" font-size="14" fill="#020617" text-anchor="middle">LIVE DUTY</text>
    
    <!-- Hero Card -->
    <rect x="24" y="110" width="672" height="140" rx="20" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
    <text x="48" y="155" font-family="system-ui, sans-serif" font-weight="800" font-size="22" fill="#ffffff">Apex Auto Care • Today's Command</text>
    <text x="48" y="195" font-family="system-ui, sans-serif" font-weight="600" font-size="15" fill="#94a3b8">Active Job Cards: 12 • Mechanics On Duty: 4 • Galla: ₹18,450</text>
    <rect x="48" y="215" width="120" height="24" rx="6" fill="#10b981"/>
    <text x="108" y="232" font-family="system-ui, sans-serif" font-weight="700" font-size="12" fill="#ffffff" text-anchor="middle">ONLINE SYNC</text>

    <!-- Quick Action Chips -->
    <rect x="24" y="275" width="210" height="90" rx="16" fill="#1e293b"/>
    <text x="44" y="315" font-family="system-ui, sans-serif" font-weight="700" font-size="16" fill="#f59e0b">⚡ Quick Q-Job</text>
    <text x="44" y="345" font-family="system-ui, sans-serif" font-weight="500" font-size="13" fill="#cbd5e1">Oil Change / Air / Wash</text>

    <rect x="255" y="275" width="210" height="90" rx="16" fill="#1e293b"/>
    <text x="275" y="315" font-family="system-ui, sans-serif" font-weight="700" font-size="16" fill="#38bdf8">📋 New Job Card</text>
    <text x="275" y="345" font-family="system-ui, sans-serif" font-weight="500" font-size="13" fill="#cbd5e1">G- General &amp; Major</text>

    <rect x="486" y="275" width="210" height="90" rx="16" fill="#1e293b"/>
    <text x="506" y="315" font-family="system-ui, sans-serif" font-weight="700" font-size="16" fill="#34d399">📦 Order Parts</text>
    <text x="506" y="345" font-family="system-ui, sans-serif" font-weight="500" font-size="13" fill="#cbd5e1">WhatsApp POs</text>

    <!-- Active Job Card Feed -->
    <rect x="24" y="390" width="672" height="150" rx="16" fill="#0f172a" stroke="#334155"/>
    <text x="48" y="430" font-family="monospace" font-weight="800" font-size="20" fill="#f59e0b">MH-12-DE-9821</text>
    <text x="260" y="430" font-family="system-ui, sans-serif" font-weight="600" font-size="16" fill="#f1f5f9">Rahul Sharma • Pulsar 150</text>
    <text x="48" y="465" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8">Complaint: Engine sound, front disc pad noise • Mechanic: Suresh</text>
    <rect x="48" y="490" width="130" height="32" rx="8" fill="#f59e0b"/>
    <text x="113" y="512" font-family="system-ui, sans-serif" font-weight="700" font-size="13" fill="#020617" text-anchor="middle">INSPECTION</text>

    <rect x="24" y="560" width="672" height="150" rx="16" fill="#0f172a" stroke="#334155"/>
    <text x="48" y="600" font-family="monospace" font-weight="800" font-size="20" fill="#f59e0b">MH-14-GH-4412</text>
    <text x="260" y="600" font-family="system-ui, sans-serif" font-weight="600" font-size="16" fill="#f1f5f9">Amit Kumar • Activa 6G</text>
    <text x="48" y="635" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8">Complaint: Periodic 3000km service + Mobil 10W30 + Brake tune</text>
    <rect x="48" y="660" width="130" height="32" rx="8" fill="#10b981"/>
    <text x="113" y="682" font-family="system-ui, sans-serif" font-weight="700" font-size="13" fill="#ffffff" text-anchor="middle">COMPLETED</text>
  </svg>`;

  await sharp(Buffer.from(narrowSvg))
    .png()
    .toFile(path.join(publicDir, 'screenshot-narrow.png'));
  console.log('Generated screenshot-narrow.png');

  // 6. screenshot-wide.png (1280x720) desktop preview screenshot
  const wideSvg = `
  <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <rect width="1280" height="720" fill="#020617"/>
    <!-- Top Nav -->
    <rect x="0" y="0" width="1280" height="64" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
    <text x="32" y="40" font-family="system-ui, sans-serif" font-weight="900" font-size="22" fill="#f59e0b">BIKEREADY WORKSHOP OS</text>
    <text x="320" y="38" font-family="system-ui, sans-serif" font-weight="600" font-size="14" fill="#e2e8f0">Daily Galla</text>
    <text x="430" y="38" font-family="system-ui, sans-serif" font-weight="600" font-size="14" fill="#e2e8f0">Master Inventory</text>
    <text x="580" y="38" font-family="system-ui, sans-serif" font-weight="600" font-size="14" fill="#e2e8f0">Suppliers</text>
    <text x="680" y="38" font-family="system-ui, sans-serif" font-weight="600" font-size="14" fill="#e2e8f0">Staff Dossier</text>
    <text x="800" y="38" font-family="system-ui, sans-serif" font-weight="600" font-size="14" fill="#e2e8f0">Reports &amp; GST</text>
    
    <!-- 4 KPI Cards -->
    <rect x="32" y="90" width="280" height="110" rx="16" fill="#0f172a" stroke="#1e293b"/>
    <text x="52" y="125" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8">NET CASH IN GALLA</text>
    <text x="52" y="165" font-family="monospace" font-weight="800" font-size="28" fill="#10b981">₹24,850</text>

    <rect x="332" y="90" width="280" height="110" rx="16" fill="#0f172a" stroke="#1e293b"/>
    <text x="352" y="125" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8">TODAY UPI COLLECTED</text>
    <text x="352" y="165" font-family="monospace" font-weight="800" font-size="28" fill="#818cf8">₹16,400</text>

    <rect x="632" y="90" width="280" height="110" rx="16" fill="#0f172a" stroke="#1e293b"/>
    <text x="652" y="125" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8">BIKES SERVICED TODAY</text>
    <text x="652" y="165" font-family="monospace" font-weight="800" font-size="28" fill="#f59e0b">19 Units</text>

    <rect x="932" y="90" width="316" height="110" rx="16" fill="#0f172a" stroke="#1e293b"/>
    <text x="952" y="125" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8">LOW STOCK ALERTS</text>
    <text x="952" y="165" font-family="monospace" font-weight="800" font-size="28" fill="#f43f5e">3 Items Need Order</text>

    <!-- Main Content Table Mockup -->
    <rect x="32" y="225" width="1216" height="460" rx="18" fill="#0f172a" stroke="#1e293b"/>
    <text x="56" y="265" font-family="system-ui, sans-serif" font-weight="800" font-size="18" fill="#f8fafc">Active Intake &amp; Workflow Pipeline</text>
  </svg>`;

  await sharp(Buffer.from(wideSvg))
    .png()
    .toFile(path.join(publicDir, 'screenshot-wide.png'));
  console.log('Generated screenshot-wide.png');

  console.log('All PWA assets successfully created!');
}

generateAssets().catch((err) => {
  console.error(err);
  process.exit(1);
});
