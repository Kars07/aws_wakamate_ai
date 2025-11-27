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

interface InventorySubAgentProps {
  loggingBucket: Bucket;
  executorFunction: Function;
}

export class InventorySubAgent extends Construct {
  public readonly agentCollaborator: AgentCollaborator;
  public readonly knowledgeBaseId: string;
  public readonly agent: Agent;
  public readonly agentAlias: AgentAlias;

  constructor(scope: Construct, id: string, props: InventorySubAgentProps) {
    super(scope, id);

    const { loggingBucket, executorFunction } = props;

    // Create knowledge base for inventory management best practices
    const inventoryKnowledgeBase = new VectorKnowledgeBase(
      this,
      "inventoryKnowledgeBase",
      {
        embeddingsModel: BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
        instruction:
          "Use this knowledge base to retrieve inventory management strategies, profitability analysis methods, and restocking best practices.",
      }
    );

    const inventoryKnowledgeBucket = new CommonBucket(
      this,
      "inventoryKnowledgeBucket",
      {
        serverAccessLogsBucket: loggingBucket,
      }
    );

    const inventoryKnowledgeSource = new S3DataSource(
      this,
      "inventoryKnowledgeSource",
      {
        bucket: inventoryKnowledgeBucket,
        knowledgeBase: inventoryKnowledgeBase,
        dataSourceName: "inventory-management-data",
      }
    );

    const inventoryIngestionRule = new Rule(this, "inventoryIngestionRule", {
      eventPattern: {
        source: ["aws.s3"],
        detail: {
          bucket: {
            name: [inventoryKnowledgeBucket.bucketName],
          },
        },
      },
      targets: [
        new AwsApi({
          service: "bedrock-agent",
          action: "startIngestionJob",
          parameters: {
            knowledgeBaseId: inventoryKnowledgeBase.knowledgeBaseId,
            dataSourceId: inventoryKnowledgeSource.dataSourceId,
          },
        }),
      ],
    });

    const inventoryKnowledgeDeployment = new BucketDeployment(
      this,
      "inventoryKnowledgeDeployment",
      {
        sources: [Source.asset(path.join(__dirname, "knowledge-base"))],
        destinationBucket: inventoryKnowledgeBucket,
        exclude: [".DS_Store"],
        prune: true,
      }
    );

    inventoryKnowledgeDeployment.node.addDependency(inventoryIngestionRule);

    const inventoryInitialIngestion = new Rule(
      this,
      "inventoryInitialIngestion",
      {
        eventPattern: {
          source: ["aws.cloudformation"],
          detailType: ["CloudFormation Resource Status Change"],
          detail: {
            resourceType: ["AWS::S3::BucketDeployment"],
            resourceStatus: ["CREATE_COMPLETE", "UPDATE_COMPLETE"],
            logicalResourceId: [inventoryKnowledgeDeployment.node.id],
          },
        },
        targets: [
          new AwsApi({
            service: "bedrock-agent",
            action: "startIngestionJob",
            parameters: {
              knowledgeBaseId: inventoryKnowledgeBase.knowledgeBaseId,
              dataSourceId: inventoryKnowledgeSource.dataSourceId,
            },
          }),
        ],
      }
    );

    const inventorySyncChecker = new KnowledgeBaseSyncChecker(
      this,
      "inventorySyncChecker",
      {
        knowledgeBaseIds: [inventoryKnowledgeBase.knowledgeBaseId],
        serviceName: "inventory-kb-sync-checker",
        checkIntervalHours: 24,
      }
    );

    // Action group for inventory operations
    const inventoryActionGroup = new AgentActionGroup({
      name: "inventoryActionGroup",
      description:
        "Handles inventory analysis, profitability calculations, and restocking recommendations using Wakamate API.",
      executor: ActionGroupExecutor.fromlambdaFunction(executorFunction),
      apiSchema: InlineApiSchema.fromLocalAsset(
        path.join(__dirname, "..", "action-group", "inventory-schema.json")
      ),
    });

    const model = BedrockFoundationModel.AMAZON_NOVA_MICRO_V1;

    const inventoryInferenceProfile = CrossRegionInferenceProfile.fromConfig({
      geoRegion: CrossRegionInferenceProfileRegion.US,
      model: model,
    });

    const inventoryAgent = new Agent(this, "inventoryAgent", {
      foundationModel: inventoryInferenceProfile,
      instruction: readFileSync(
        path.join(__dirname, "instructions.txt"),
        "utf-8"
      ),
      knowledgeBases: [inventoryKnowledgeBase],
      actionGroups: [inventoryActionGroup],
      userInputEnabled: true,
      shouldPrepareAgent: true,
      idleSessionTTL: Duration.seconds(1800),
    });

    inventoryAgent.role.addToPrincipalPolicy(
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
          inventoryInferenceProfile.inferenceProfileArn,
          inventoryKnowledgeBase.knowledgeBaseArn,
        ],
      })
    );

    const inventoryAgentAlias = new AgentAlias(this, "alias", {
      agent: inventoryAgent,
    });

    const inventoryAgentCollaborator = new AgentCollaborator({
      agentAlias: inventoryAgentAlias,
      collaborationInstruction:
        "Expert in inventory management, sales analysis, profitability optimization, and restocking strategies. Provides actionable insights and recommendations for business optimization.",
      collaboratorName: "Inventory",
      relayConversationHistory: true,
    });

    this.agentCollaborator = inventoryAgentCollaborator;
    this.knowledgeBaseId = inventoryKnowledgeBase.knowledgeBaseId;
    this.agent = inventoryAgent;
    this.agentAlias = inventoryAgentAlias;
  }
}
