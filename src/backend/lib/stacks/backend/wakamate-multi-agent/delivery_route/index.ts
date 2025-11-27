import {
  ActionGroupExecutor,
  Agent,
  AgentActionGroup,
  AgentAlias,
  AgentCollaborator,
  BedrockFoundationModel,
  CrossRegionInferenceProfile,
  CrossRegionInferenceProfileRegion,
  InlineApiSchema,
  S3DataSource,
  VectorKnowledgeBase,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { Duration } from "aws-cdk-lib";
import { Rule } from "aws-cdk-lib/aws-events";
import { AwsApi } from "aws-cdk-lib/aws-events-targets";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Function } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { readFileSync } from "fs";
import * as path from "path";
import { CommonBucket } from "../../../../common/constructs/s3";
import { KnowledgeBaseSyncChecker } from "../kb-sync-checker/construct";

interface DeliveryRouteSubAgentProps {
  loggingBucket: Bucket;
  executorFunction: Function;
}

export class DeliveryRouteSubAgent extends Construct {
  public readonly agentCollaborator: AgentCollaborator;
  public readonly knowledgeBaseId: string;
  public readonly agent: Agent;
  public readonly agentAlias: AgentAlias;

  constructor(scope: Construct, id: string, props: DeliveryRouteSubAgentProps) {
    super(scope, id);

    const { loggingBucket, executorFunction } = props;

    // Create knowledge base for delivery route optimization data
    const deliveryKnowledgeBase = new VectorKnowledgeBase(
      this,
      "deliveryKnowledgeBase",
      {
        embeddingsModel: BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
        instruction:
          "Use this knowledge base to retrieve Lagos traffic patterns, route optimization strategies, and delivery best practices.",
      }
    );

    const deliveryKnowledgeBucket = new CommonBucket(
      this,
      "deliveryKnowledgeBucket",
      {
        serverAccessLogsBucket: loggingBucket,
      }
    );

    const deliveryKnowledgeSource = new S3DataSource(
      this,
      "deliveryKnowledgeSource",
      {
        bucket: deliveryKnowledgeBucket,
        knowledgeBase: deliveryKnowledgeBase,
        dataSourceName: "delivery-optimization-data",
      }
    );

    const deliveryIngestionRule = new Rule(this, "deliveryIngestionRule", {
      eventPattern: {
        source: ["aws.s3"],
        detail: {
          bucket: {
            name: [deliveryKnowledgeBucket.bucketName],
          },
        },
      },
      targets: [
        new AwsApi({
          service: "bedrock-agent",
          action: "startIngestionJob",
          parameters: {
            knowledgeBaseId: deliveryKnowledgeBase.knowledgeBaseId,
            dataSourceId: deliveryKnowledgeSource.dataSourceId,
          },
        }),
      ],
    });

    // Deploy knowledge base content
    const deliveryKnowledgeDeployment = new BucketDeployment(
      this,
      "deliveryKnowledgeDeployment",
      {
        sources: [Source.asset(path.join(__dirname, "knowledge-base"))],
        destinationBucket: deliveryKnowledgeBucket,
        exclude: [".DS_Store"],
        prune: true,
      }
    );

    deliveryKnowledgeDeployment.node.addDependency(deliveryIngestionRule);

    // Initial ingestion after deployment
    const deliveryInitialIngestion = new Rule(
      this,
      "deliveryInitialIngestion",
      {
        eventPattern: {
          source: ["aws.cloudformation"],
          detailType: ["CloudFormation Resource Status Change"],
          detail: {
            resourceType: ["AWS::S3::BucketDeployment"],
            resourceStatus: ["CREATE_COMPLETE", "UPDATE_COMPLETE"],
            logicalResourceId: [deliveryKnowledgeDeployment.node.id],
          },
        },
        targets: [
          new AwsApi({
            service: "bedrock-agent",
            action: "startIngestionJob",
            parameters: {
              knowledgeBaseId: deliveryKnowledgeBase.knowledgeBaseId,
              dataSourceId: deliveryKnowledgeSource.dataSourceId,
            },
          }),
        ],
      }
    );

    // Sync checker
    const deliverySyncChecker = new KnowledgeBaseSyncChecker(
      this,
      "deliverySyncChecker",
      {
        knowledgeBaseIds: [deliveryKnowledgeBase.knowledgeBaseId],
        serviceName: "delivery-kb-sync-checker",
        checkIntervalHours: 24,
      }
    );

    // Action group for delivery route operations
    const deliveryActionGroup = new AgentActionGroup({
      name: "deliveryRouteActionGroup",
      description:
        "Handles delivery route optimization, geocoding, and traffic analysis for Lagos.",
      executor: ActionGroupExecutor.fromlambdaFunction(executorFunction),
      apiSchema: InlineApiSchema.fromLocalAsset(
        path.join(__dirname, "..", "action-group", "delivery-route-schema.json")
      ),
    });

    const model = BedrockFoundationModel.AMAZON_NOVA_LITE_V1;

    const deliveryInferenceProfile = CrossRegionInferenceProfile.fromConfig({
      geoRegion: CrossRegionInferenceProfileRegion.US,
      model: model,
    });

    const deliveryAgent = new Agent(this, "deliveryAgent", {
      foundationModel: deliveryInferenceProfile,
      instruction: readFileSync(
        path.join(__dirname, "instructions.txt"),
        "utf-8"
      ),
      knowledgeBases: [deliveryKnowledgeBase],
      actionGroups: [deliveryActionGroup],
      userInputEnabled: true,
      shouldPrepareAgent: true,
      idleSessionTTL: Duration.seconds(1800),
    });

    deliveryAgent.role.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:GetInferenceProfile",
          "bedrock:GetFoundationModel",
          "bedrock:Retrieve",
        ],
        resources: [
          `arn:aws:bedrock:*::foundation-model/${model.modelId}`,
          deliveryInferenceProfile.inferenceProfileArn,
          deliveryKnowledgeBase.knowledgeBaseArn,
        ],
      })
    );

    const deliveryAgentAlias = new AgentAlias(this, "alias", {
      agent: deliveryAgent,
    });

    const deliveryAgentCollaborator = new AgentCollaborator({
      agentAlias: deliveryAgentAlias,
      collaborationInstruction:
        "Expert in Lagos delivery route optimization, traffic analysis, and logistics planning. Handles geocoding, TSP optimization, and provides real-time traffic intelligence.",
      collaboratorName: "DeliveryRoute",
      relayConversationHistory: true,
    });

    this.agentCollaborator = deliveryAgentCollaborator;
    this.knowledgeBaseId = deliveryKnowledgeBase.knowledgeBaseId;
    this.agent = deliveryAgent;
    this.agentAlias = deliveryAgentAlias;
  }
}
