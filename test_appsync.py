#!/usr/bin/env python3
"""
Test script for Wakamate Multi-Agent AppSync API
This script authenticates with Cognito and sends a test query
"""

import boto3
import requests
import json
from warrant import Cognito

# Configuration
USER_POOL_ID = "us-east-1_GoEVCgBSx"
CLIENT_ID_COMMAND = "aws cognito-idp list-user-pool-clients --user-pool-id us-east-1_GoEVCgBSx --region us-east-1 --query 'UserPoolClients[0].ClientId' --output text"
REGION = "us-east-1"
GRAPHQL_ENDPOINT = "https://grgm2q5xwzbizksh3xsjfdrt2i.appsync-api.us-east-1.amazonaws.com/graphql"

# Test credentials
USERNAME = "testuser"
PASSWORD = "MySecurePass123!"

def get_client_id():
    """Get the Cognito User Pool Client ID"""
    import subprocess
    result = subprocess.run(
        ["aws", "cognito-idp", "list-user-pool-clients", 
         "--user-pool-id", USER_POOL_ID, 
         "--region", REGION,
         "--query", "UserPoolClients[0].ClientId",
         "--output", "text"],
        capture_output=True,
        text=True
    )
    return result.stdout.strip()

def authenticate():
    """Authenticate with Cognito and get ID token"""
    client = boto3.client('cognito-idp', region_name=REGION)
    
    try:
        # Get client ID
        client_id = get_client_id()
        print(f"Using Client ID: {client_id}")
        
        # Initiate auth
        response = client.initiate_auth(
            ClientId=client_id,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': USERNAME,
                'PASSWORD': PASSWORD
            }
        )
        
        id_token = response['AuthenticationResult']['IdToken']
        print("✅ Authentication successful!")
        return id_token
        
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return None

def test_query(id_token):
    """Send a test GraphQL query"""
    
    # Test query: List sessions
    query = """
    query ListSessions {
      listSessions {
        items {
          id
          userId
        }
      }
    }
    """
    
    headers = {
        'Authorization': id_token,
        'Content-Type': 'application/json'
    }
    
    payload = {
        'query': query
    }
    
    print("\n Sending query to AppSync...")
    response = requests.post(GRAPHQL_ENDPOINT, json=payload, headers=headers)
    
    if response.status_code == 200:
        print(" Query successful!")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f" Query failed with status {response.status_code}")
        print(response.text)

def test_mutation(id_token):
    """Send a test chat mutation to the multi-agent system"""
    
    mutation = """
    mutation TestChat {
      sendChat(
        sessionId: "test-session-001"
        human: "What's the best delivery route from Ikeja to Victoria Island?"
      )
    }
    """
    
    headers = {
        'Authorization': id_token,
        'Content-Type': 'application/json'
    }
    
    payload = {
        'query': mutation
    }
    
    print("\n Sending chat mutation to multi-agent system...")
    response = requests.post(GRAPHQL_ENDPOINT, json=payload, headers=headers)
    
    if response.status_code == 200:
        print("Mutation successful!")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"Mutation failed with status {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    print(" Testing Wakamate Multi-Agent System\n")
    
    # Step 1: Authenticate
    id_token = authenticate()
    
    if id_token:
        # Step 2: Test query
        test_query(id_token)
        
        # Step 3: Test mutation (chat with agents)
        test_mutation(id_token)
    else:
        print("\n Cannot proceed without authentication")
