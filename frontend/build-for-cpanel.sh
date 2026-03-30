#!/bin/bash
# =============================================================
#  ExeGuard – Build & Package for cPanel (Node.js Selector)
#  Chạy script này 1 lần để tạo file zip upload lên cPanel
# =============================================================

set -e

# ─── 1. Kiểm tra .env.local ───────────────────────────────
if [ ! -f ".env.local" ]; then
  echo "❌  Chưa có .env.local !"
  echo "    Tạo file .env.local và điền:"
  echo ""
  echo "    NEXT_PUBLIC_API_URL=https://your-app.up.railway.app/api"
  echo "    NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_key"
  echo ""
  exit 1
fi

echo "✅  Đọc .env.local OK"
echo "──────────────────────────────────────────────────────"

# ─── 2. Cài dependencies ──────────────────────────────────
echo "📦  npm install..."
npm install

# ─── 3. Build Next.js ─────────────────────────────────────
echo "🔨  npm run build..."
npm run build

# ─── 4. Copy static + public vào standalone ───────────────
echo "📁  Copy .next/static & public vào standalone..."
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public
cp .env.local       .next/standalone/.env.local 2>/dev/null || true

# ─── 5. Thêm file helper cho cPanel ───────────────────────
cp cpanel-start.js .next/standalone/cpanel-start.js

# ─── 6. Tạo package.json tối giản cho standalone ──────────
cat > .next/standalone/package.json << 'EOF'
{
  "name": "exeguard-frontend",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "start": "node server.js"
  }
}
EOF

# ─── 7. Zip lại ────────────────────────────────────────────
OUTPUT="exeguard-cpanel.zip"
rm -f "$OUTPUT"
echo "🗜️   Tạo $OUTPUT..."
cd .next/standalone
zip -r "../../$OUTPUT" . -x "*.DS_Store" -x "__MACOSX/*"
cd ../..

echo ""
echo "══════════════════════════════════════════════════════"
echo "✅  XONG! File: $OUTPUT"
echo ""
echo "  Upload lên cPanel:"
echo "  1. File Manager → upload exeguard-cpanel.zip"
echo "     vào thư mục gốc app (vd: ~/exeguard/)"
echo "  2. Extract tại chỗ"
echo "  3. Node.js Selector:"
echo "     - App root:    exeguard/"
echo "     - Startup file: server.js"
echo "     - Node version: 18.x hoặc 20.x"
echo "  4. Env Variables thêm:"
echo "     HOSTNAME = 0.0.0.0"
echo "     NODE_ENV = production"
echo "  5. Nhấn START"
echo "══════════════════════════════════════════════════════"
