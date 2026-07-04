#!/bin/bash
set -e

echo "⏳ Waiting for database to be fully up and ready..."
# Simple check
sleep 3

echo "🚀 Applying database migrations..."
alembic upgrade head

echo "✅ Migrations complete. Database initialized."
