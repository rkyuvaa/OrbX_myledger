#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   ORBX MY LEDGER — SSL SETUP (PORT 8070)           ${NC}"
echo -e "${BLUE}====================================================${NC}"

DOMAIN="nexus.orbx.in"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

# Check if certificates exist
if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
    echo -e "${GREEN}✓ SSL certificate found at $CERT_PATH${NC}"
else
    echo -e "${YELLOW}! Certificate not found for $DOMAIN.${NC}"
    echo -e "${YELLOW}Starting Certbot DNS challenge to generate free Let's Encrypt SSL certificate...${NC}"

    if ! command -v certbot >/dev/null 2>&1; then
        echo -e "${BLUE}Installing Certbot...${NC}"
        apt-get update && apt-get install -y certbot
    fi

    echo -e "\n${YELLOW}------------------------------------------------------------${NC}"
    echo -e "${YELLOW}Certbot will now ask you to create a TXT record in Cloudflare.${NC}"
    echo -e "${YELLOW}Record Name : _acme-challenge.nexus${NC}"
    echo -e "${YELLOW}Record Value: (Certbot will print this value below)${NC}"
    echo -e "${YELLOW}------------------------------------------------------------${NC}\n"

    certbot certonly --manual --preferred-challenges dns -d "$DOMAIN"
fi

# Verify cert exists now
if [ ! -f "$CERT_PATH" ]; then
    echo -e "${RED}Error: Certificate generation was not completed.${NC}"
    exit 1
fi

echo -e "\n${GREEN}Applying SSL configuration to Nginx (Port 8070)...${NC}"
docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d nginx

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}   SSL SUCCESSFULLY ENABLED!                        ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "You can now securely access your ledger at:"
echo -e "${BLUE}https://nexus.orbx.in:8070${NC}"
