import { StackProps } from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { CommonStack } from "../../common/constructs/stack";
import { Auth } from "./auth";
import { Storage } from "./storage";
import { StreamingApi } from "./streaming-api";
import { WakamateMultiAgent } from "./wakamate-multi-agent";

interface BackendStackProps extends StackProps {
  urls: string[];
}

export class BackendStack extends CommonStack {
  public readonly environmentVariables: Record<string, string>;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const auth = new Auth(this, "auth", {
      urls: props.urls,
    });

    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "Lambda functions require managed policies to interface with the vpc.",
      },
    ]);

    const storage = new Storage(this, "storage", {
      urls: props.urls,
    });
    storage.structuredDataBucket.grantReadWrite(auth.authenticatedRole);

    const wakamateMultiAgent = new WakamateMultiAgent(
      this,
      "wakamateMultiAgent",
      {
        structuredDataBucket: storage.structuredDataBucket,
        apiBaseUrl:
          process.env.WAKAMATE_API_BASE_URL || "http://localhost:1050",
        authToken: process.env.WAKAMATE_AUTH_TOKEN || "",
      }
    );

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

      // Agent IDs for trace identification
      VITE_SUPERVISOR_AGENT_ID: wakamateMultiAgent.supervisorAgent.agentId,
      VITE_SUPERVISOR_ALIAS_ID: wakamateMultiAgent.supervisorAgentAlias.aliasId,
      VITE_DELIVERY_AGENT_ID:
        wakamateMultiAgent.deliveryRouteSubAgent.agent.agentId,
      VITE_DELIVERY_ALIAS_ID:
        wakamateMultiAgent.deliveryRouteSubAgent.agentAlias.aliasId,
      VITE_CAPTION_AGENT_ID:
        wakamateMultiAgent.captionGeneratorSubAgent.agent.agentId,
      VITE_CAPTION_ALIAS_ID:
        wakamateMultiAgent.captionGeneratorSubAgent.agentAlias.aliasId,
      VITE_INVENTORY_AGENT_ID:
        wakamateMultiAgent.inventorySubAgent.agent.agentId,
      VITE_INVENTORY_ALIAS_ID:
        wakamateMultiAgent.inventorySubAgent.agentAlias.aliasId,
    };
  }
}
