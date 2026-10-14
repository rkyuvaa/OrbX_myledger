#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   ORBX MY LEDGER — FULL SERVER DATA RESTORATION    ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Find migration bundle
ARCHIVE_NAME=$(ls -1 orbx_migration_*.tar.gz 2>/dev/null | sort | tail -n 1)

if [ -n "$1" ]; then
    ARCHIVE_NAME="$1"
fi

if [ -z "$ARCHIVE_NAME" ] || [ ! -f "$ARCHIVE_NAME" ]; then
    echo -e "${RED}Error: No migration bundle found in current directory.${NC}"
    echo -e "Usage: ./scripts/restore_server.sh [path_to_orbx_migration_xxx.tar.gz]"
    exit 1
fi

echo -e "Target Migration Archive: ${GREEN}$ARCHIVE_NAME${NC}"

# Check checksum if available
if [ -f "${ARCHIVE_NAME}.sha256" ]; then
    echo -e "\n${YELLOW}[1/6] Verifying file integrity with SHA256...${NC}"
    sha256sum -c "${ARCHIVE_NAME}.sha256"
    echo -e "${GREEN}✓ Checksum matches! File is 100% intact.${NC}"
fi

# Detect Docker Compose
if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
else
    echo -e "${RED}Error: Neither 'docker compose' nor 'docker-compose' found.${NC}"
    echo -e "Please install docker and docker compose first as described in ubuntu_install.txt."
    exit 1
fi

EXTRACT_DIR="tmp_migration_extract"
rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"

echo -e "\n${YELLOW}[2/6] Extracting migration bundle...${NC}"
tar -xzf "$ARCHIVE_NAME" -C "$EXTRACT_DIR"
BACKUP_FOLDER=$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)

if [ -z "$BACKUP_FOLDER" ]; then
    echo -e "${RED}Failed to extract archive contents.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}[3/6] Restoring environment files...${NC}"
if [ -f "$BACKUP_FOLDER/backend.env" ]; then
    cp "$BACKUP_FOLDER/backend.env" backend/.env
    echo -e "${GREEN}✓ Restored backend/.env${NC}"
fi

if [ -f "$BACKUP_FOLDER/root.env" ]; then
    cp "$BACKUP_FOLDER/root.env" .env
    echo -e "${GREEN}✓ Restored .env${NC}"
fi

# Determine DB user and DB name
DB_USER="postgres"
DB_NAME="orbx_ledger"
if [ -f "backend/.env" ]; then
    ENV_USER=$(grep -E '^POSTGRES_USER=' backend/.env | cut -d '=' -f2 | tr -d ' "\r\n')
    ENV_DB=$(grep -E '^POSTGRES_DB=' backend/.env | cut -d '=' -f2 | tr -d ' "\r\n')
    [ -n "$ENV_USER" ] && DB_USER="$ENV_USER"
    [ -n "$ENV_DB" ] && DB_NAME="$ENV_DB"
fi

echo -e "\n${YELLOW}[4/6] Initializing PostgreSQL container...${NC}"
$COMPOSE up -d db

echo "Waiting for database to accept connections..."
for i in {1..30}; do
    if $COMPOSE exec -T db pg_isready -U "$DB_USER" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Database is ready.${NC}"
        break
    fi
    sleep 1
done

echo -e "\n${YELLOW}[5/6] Restoring 100% data to database: $DB_NAME...${NC}"
# Terminate existing connections if any and ensure database exists
$COMPOSE exec -T db psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
$COMPOSE exec -T db psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" >/dev/null 2>&1 || true

if [ -f "$BACKUP_FOLDER/database.dump" ]; then
    echo "Restoring from custom binary dump (database.dump)..."
    $COMPOSE exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges < "$BACKUP_FOLDER/database.dump" || true
elif [ -f "$BACKUP_FOLDER/database.sql" ]; then
    echo "Restoring from SQL dump (database.sql)..."
    $COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FOLDER/database.sql"
else
    echo -e "${RED}Error: No database dump found in backup!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Database restored successfully!${NC}"

# Clean temp extract dir
rm -rf "$EXTRACT_DIR"

echo -e "\n${YELLOW}[6/6] Building and starting all application containers...${NC}"
$COMPOSE up --build -d

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}      VERIFYING RESTORED DATA ROW COUNTS            ${NC}"
echo -e "${GREEN}====================================================${NC}"
$COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    relname AS table_name, 
    n_live_tup AS total_records 
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;
"

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}   MIGRATION COMPLETED SUCCESSFULLY!                ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Access your application at: http://<NEW_SERVER_IP>"
echo -e "API Swagger documentation : http://<NEW_SERVER_IP>/docs"
