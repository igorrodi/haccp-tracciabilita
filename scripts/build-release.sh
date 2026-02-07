#!/bin/bash
#
# Build frontend.zip for GitHub releases
# Run this on your development machine, NOT on Raspberry Pi
#

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly BUILD_DIR="${PROJECT_ROOT}/dist"
readonly RELEASE_DIR="${PROJECT_ROOT}/release"

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[✓]${NC} $1"; }

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  BUILD RELEASE FOR GITHUB${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$PROJECT_ROOT"

# Clean previous builds
log_info "Cleaning previous builds..."
rm -rf "$BUILD_DIR" "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Install dependencies
log_info "Installing dependencies..."
npm ci --silent 2>/dev/null || npm install --silent

# Build frontend
log_info "Building frontend..."
npm run build

# Create frontend.zip
log_info "Creating frontend.zip..."
cd "$BUILD_DIR"
zip -r -q "${RELEASE_DIR}/frontend.zip" .

# Copy schema
log_info "Copying PocketBase schema..."
cp "${PROJECT_ROOT}/scripts/pocketbase/pb_schema.json" "${RELEASE_DIR}/"

# Summary
echo ""
log_ok "Release files created in: ${RELEASE_DIR}/"
echo ""
echo "Files to upload to GitHub Release:"
ls -lah "${RELEASE_DIR}/"
echo ""
echo "Next steps:"
echo "  1. Create a new GitHub Release"
echo "  2. Upload frontend.zip and pb_schema.json"
echo "  3. Installation will work via:"
echo "     curl -sSL https://raw.githubusercontent.com/USER/haccp-tracciabilita/main/scripts/install.sh | sudo bash"
echo ""
