import { WakamateMultiAgent } from "./wakamate-multi-agent";
import { Storage } from "./storage";
import { StreamingApi } from "./streaming-api";
import { Auth } from "./auth";

const wakamateMultiAgent = new WakamateMultiAgent(this, "wakamateMultiAgent", {
  structuredDataBucket: storage.structuredDataBucket,
  apiBaseUrl: process.env.WAKAMATE_API_BASE_URL || "http://localhost:1050",
  authToken: process.env.WAKAMATE_AUTH_TOKEN || "",
});

const streamingApi = new StreamingApi(this, "streamingApi", {
  userPool: auth.userPool,
  regionalWebAclArn: auth.regionalWebAclArn,
  supervisorAgent: wakamateMultiAgent.supervisorAgent,
  supervisorAgentAlias: wakamateMultiAgent.supervisorAgentAlias,
});

this.environmentVariables = {
  VITE_REGION: this.region!,
  VITE_CALLBACK_URL: props.urls[0],
  VITE_USER_POOL_ID: auth.userPool.userPoolId,
  ...(auth.userPoolDomain && {
    VITE_USER_POOL_DOMAIN_URL: auth.userPoolDomain
      .baseUrl()
      .replace("https://", ""),
  }),
  VITE_USER_POOL_CLIENT_ID: auth.userPoolClient.userPoolClientId,
  VITE_IDENTITY_POOL_ID: auth.identityPool.attrId,
  CODEGEN_GRAPH_API_ID: streamingApi.amplifiedGraphApi.apiId,
  VITE_GRAPH_API_URL: streamingApi.amplifiedGraphApi.graphqlUrl,
  VITE_STORAGE_BUCKET_NAME: storage.structuredDataBucket.bucketName,
  VITE_WEBSOCKET_ENDPOINT: streamingApi.amplifiedGraphApi.realtimeUrl,

  VITE_SUPERVISOR_AGENT_ID: wakamateMultiAgent.supervisorAgent.agentId,
  VITE_SUPERVISOR_ALIAS_ID: wakamateMultiAgent.supervisorAgentAlias.aliasId,
  VITE_DELIVERY_AGENT_ID:
    wakamateMultiAgent.deliveryRouteSubAgent.agent.agentId,
  VITE_CAPTION_AGENT_ID:
    wakamateMultiAgent.captionGeneratorSubAgent.agent.agentId,
  VITE_INVENTORY_AGENT_ID: wakamateMultiAgent.inventorySubAgent.agent.agentId,
};
