# Complete Server Migration Guide: Transferring OrbX My Ledger with 100% Data

This guide guarantees **100% data integrity with zero data loss** when moving from your old server to your new server.

---

## 📋 Overview of What is Transferred
1. **PostgreSQL Database (`orbx_ledger`)**: All user accounts, chart of accounts, vouchers (receipt, payment, contra), journal entries, balances, audit logs, and transaction history.
2. **Environment & Secrets (`backend/.env`)**: Secret keys, auth token expiration policies, and application configurations.
3. **Application Stack & Reverse Proxy (`docker-compose.yml`, `nginx/nginx.conf`)**: Backend (FastAPI), Frontend (Vite/React), and Nginx reverse proxy.

---

## 🚀 METHOD 1: Automated 2-Command Migration (Recommended)

### STEP 1: On the OLD Server (Export 100% of Data)
Run the following inside your `OrbX_myledger` directory on the old server:

```bash
cd ~/OrbX_myledger
chmod +x scripts/export_server.sh
./scripts/export_server.sh
```

**What this does automatically:**
- Temporarily pauses backend writes so no transactions are missed.
- Takes a full binary database dump (`database.dump`) and SQL dump (`database.sql`).
- Bundles your `backend/.env` file with your secret keys.
- Packages everything into a single compressed bundle: `orbx_migration_<TIMESTAMP>.tar.gz`.
- Generates a SHA256 checksum to verify file integrity.

---

### STEP 2: Transfer the Backup to the NEW Server
From your **Old Server**, securely copy the bundle to your new server:

```bash
scp orbx_migration_*.tar.gz orbx_migration_*.sha256 root@<NEW_SERVER_IP>:~/
```
*(Replace `<NEW_SERVER_IP>` with the public IP of your newly purchased server).*

---

### STEP 3: On the NEW Server (Setup & Restore)

1. **Connect to your new server via SSH:**
   ```bash
   ssh root@<NEW_SERVER_IP>
   ```

2. **Install Docker & Docker Compose (if not yet installed):**
   ```bash
   sudo apt update && sudo apt install -y curl git
   curl -fsSL https://get.docker.com | sh
   sudo apt install -y docker-compose-plugin
   ```

3. **Clone the repository:**
   ```bash
   git clone https://github.com/rkyuvaa/OrbX_myledger.git
   cd OrbX_myledger
   ```

4. **Move the transferred archive into the project directory:**
   ```bash
   mv ~/orbx_migration_*.tar.gz ~/orbx_migration_*.sha256 ./
   ```

5. **Run the 1-click restore script:**
   ```bash
   chmod +x scripts/restore_server.sh
   ./scripts/restore_server.sh
   ```

**What this does automatically:**
- Verifies SHA256 checksum so not a single byte is corrupted.
- Restores `backend/.env` automatically.
- Launches the PostgreSQL database container.
- Restores all tables, sequences, foreign keys, and transaction history.
- Builds and starts Backend, Frontend, and Nginx containers.
- Prints the exact count of restored records for every table on your screen.

---

## 🛠️ METHOD 2: Manual Step-by-Step Command Line

If you prefer to run each command manually:

### On Old Server:
```bash
# 1. Stop backend to freeze writes
sudo docker compose stop backend

# 2. Dump PostgreSQL database
sudo docker compose exec -T db pg_dump -U postgres -d orbx_ledger -Fc > orbx_ledger_backup.dump

# 3. Copy .env and backup to new server
scp orbx_ledger_backup.dump root@<NEW_SERVER_IP>:~/
scp backend/.env root@<NEW_SERVER_IP>:~/backend.env
```

### On New Server:
```bash
# 1. Clone repository
git clone https://github.com/rkyuvaa/OrbX_myledger.git
cd OrbX_myledger

# 2. Place environment file
mv ~/backend.env backend/.env

# 3. Start Database container first
sudo docker compose up -d db
sleep 5

# 4. Restore the database
sudo docker compose exec -T db pg_restore -U postgres -d orbx_ledger --clean --if-exists < ~/orbx_ledger_backup.dump

# 5. Start all services
sudo docker compose up --build -d
```

---

## ✅ Post-Migration Verification
1. Open your browser at `http://<NEW_SERVER_IP>:8070` (or `http://51.77.117.66:8070`).
2. Log in with your existing credentials.
3. Check **Dashboard**, **Bank Accounts**, **Cash Accounts**, and **Ledger Reports** to confirm all balances and historical entries are intact.
4. If using a domain (e.g. `ledger.yourcompany.com`), update your domain's DNS `A` record to point to `<NEW_SERVER_IP>`.
