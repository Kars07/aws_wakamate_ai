#!/bin/bash
# Simple test script for Wakamate AppSync API

set -e

# Configuration
USER_POOL_ID="us-east-1_GoEVCgBSx"
REGION="us-east-1"
GRAPHQL_ENDPOINT="https://grgm2q5xwzbizksh3xsjfdrt2i.appsync-api.us-east-1.amazonaws.com/graphql"
USERNAME="testuser"
PASSWORD="MySecurePass123!"

echo "Testing Wakamate Multi-Agent System"
echo "========================================"
echo ""

# Step 1: Get Client ID
echo "Getting Cognito Client ID..."
CLIENT_ID=$(aws cognito-idp list-user-pool-clients \
  --user-pool-id "$USER_POOL_ID" \
  --region "$REGION" \
  --query 'UserPoolClients[0].ClientId' \
  --output text)

if [ -z "$CLIENT_ID" ]; then
  echo "Failed to get Client ID"
  exit 1
fi

echo "Client ID: $CLIENT_ID"
echo ""

# Step 2: Authenticate and get ID token
echo "Authenticating with Cognito..."
AUTH_RESPONSE=$(aws cognito-idp initiate-auth \
  --client-id "$CLIENT_ID" \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME="$USERNAME",PASSWORD="$PASSWORD" \
  --region "$REGION" \
  --output json)

ID_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.AuthenticationResult.IdToken')

if [ -z "$ID_TOKEN" ] || [ "$ID_TOKEN" = "null" ]; then
  echo "Authentication failed"
  echo "$AUTH_RESPONSE"
  exit 1
fi

echo "Authentication successful!"
echo ""

# Step 3: Test Query - List Sessions
echo "Testing Query: List Sessions..."
QUERY='{"query":"query { listSessions { items { id userId } } }"}'

RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
  -H "Authorization: $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$QUERY")

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

# Step 4: Test Mutation - Send Chat
echo "Testing Mutation: Send Chat to Multi-Agent..."
MUTATION='{"query":"mutation { sendChat(sessionId: \"test-001\", human: \"What is the best delivery route from Ikeja to Victoria Island?\") }"}'

RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
  -H "Authorization: $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$MUTATION")

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

echo "Test complete!"
