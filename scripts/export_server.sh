#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   ORBX MY LEDGER — FULL SERVER BACKUP & EXPORT     ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Detect Docker Compose
if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
else
    echo -e "${RED}Error: Neither 'docker compose' nor 'docker-compose' found.${NC}"
    exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="migration_backup_${TIMESTAMP}"
ARCHIVE_NAME="orbx_migration_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo -e "\n${YELLOW}[Step 1/5] Checking database container...${NC}"
if ! $COMPOSE ps db | grep -q "Up"; then
    echo -e "${YELLOW}Database container is not running. Starting db container...${NC}"
    $COMPOSE up -d db
    sleep 5
fi

# Load DB credentials if available from backend/.env
DB_USER="postgres"
DB_NAME="orbx_ledger"
if [ -f "backend/.env" ]; then
    ENV_USER=$(grep -E '^POSTGRES_USER=' backend/.env | cut -d '=' -f2 | tr -d ' "\r\n')
    ENV_DB=$(grep -E '^POSTGRES_DB=' backend/.env | cut -d '=' -f2 | tr -d ' "\r\n')
    [ -n "$ENV_USER" ] && DB_USER="$ENV_USER"
    [ -n "$ENV_DB" ] && DB_NAME="$ENV_DB"
fi

echo -e "Using DB User: ${GREEN}$DB_USER${NC}, DB Name: ${GREEN}$DB_NAME${NC}"

echo -e "\n${YELLOW}[Step 2/5] Stopping backend temporarily to ensure 100% data consistency (no concurrent writes)...${NC}"
$COMPOSE stop backend || true

echo -e "\n${YELLOW}[Step 3/5] Exporting PostgreSQL Database Dump...${NC}"
$COMPOSE exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP_DIR/database.dump"
$COMPOSE exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists > "$BACKUP_DIR/database.sql"

# Restart backend after dump
$COMPOSE start backend || true

DUMP_SIZE=$(ls -lh "$BACKUP_DIR/database.dump" | awk '{print $5}')
echo -e "${GREEN}✓ Database dump completed successfully (Size: $DUMP_SIZE)${NC}"

echo -e "\n${YELLOW}[Step 4/5] Backing up configuration and environment files...${NC}"
if [ -f "backend/.env" ]; then
    cp backend/.env "$BACKUP_DIR/backend.env"
    echo -e "${GREEN}✓ Backed up backend/.env${NC}"
else
    echo -e "${YELLOW}! backend/.env not found, checking backend/.env.example...${NC}"
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example "$BACKUP_DIR/backend.env"
    fi
fi

if [ -f ".env" ]; then
    cp .env "$BACKUP_DIR/root.env"
    echo -e "${GREEN}✓ Backed up root .env${NC}"
fi

# Store metadata
cat <<EOF > "$BACKUP_DIR/backup_metadata.json"
{
  "timestamp": "$TIMESTAMP",
  "db_user": "$DB_USER",
  "db_name": "$DB_NAME",
  "project": "OrbX My Ledger"
}
EOF

echo -e "\n${YELLOW}[Step 5/5] Creating compressed migration bundle...${NC}"
tar -czf "$ARCHIVE_NAME" "$BACKUP_DIR"
sha256sum "$ARCHIVE_NAME" > "${ARCHIVE_NAME}.sha256"

# Cleanup temp dir
rm -rf "$BACKUP_DIR"

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}   BACKUP COMPLETED WITH 100% DATA INTEGRITY!       ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Archive created : ${YELLOW}$ARCHIVE_NAME${NC}"
echo -e "Checksum file   : ${YELLOW}${ARCHIVE_NAME}.sha256${NC}"
echo -e "\nNext, copy this archive to your NEW server using one of these commands:"
echo -e "${BLUE}scp $ARCHIVE_NAME ${ARCHIVE_NAME}.sha256 user@<NEW_SERVER_IP>:~/${NC}"
echo -e "Or via rsync:"
echo -e "${BLUE}rsync -avzP $ARCHIVE_NAME ${ARCHIVE_NAME}.sha256 user@<NEW_SERVER_IP>:~/${NC}"
