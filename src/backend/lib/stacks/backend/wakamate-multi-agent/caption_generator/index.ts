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

interface CaptionGeneratorSubAgentProps {
  loggingBucket: Bucket;
  executorFunction: Function;
}

export class CaptionGeneratorSubAgent extends Construct {
  public readonly agentCollaborator: AgentCollaborator;
  public readonly knowledgeBaseId: string;
  public readonly agent: Agent;
  public readonly agentAlias: AgentAlias;

  constructor(
    scope: Construct,
    id: string,
    props: CaptionGeneratorSubAgentProps
  ) {
    super(scope, id);

    const { loggingBucket, executorFunction } = props;

    // Create knowledge base for caption templates and best practices
    const captionKnowledgeBase = new VectorKnowledgeBase(
      this,
      "captionKnowledgeBase",
      {
        embeddingsModel: BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
        instruction:
          "Use this knowledge base to retrieve social media caption templates, hashtag strategies, and platform-specific best practices.",
      }
    );

    const captionKnowledgeBucket = new CommonBucket(
      this,
      "captionKnowledgeBucket",
      {
        serverAccessLogsBucket: loggingBucket,
      }
    );

    const captionKnowledgeSource = new S3DataSource(
      this,
      "captionKnowledgeSource",
      {
        bucket: captionKnowledgeBucket,
        knowledgeBase: captionKnowledgeBase,
        dataSourceName: "caption-templates-data",
      }
    );

    const captionIngestionRule = new Rule(this, "captionIngestionRule", {
      eventPattern: {
        source: ["aws.s3"],
        detail: {
          bucket: {
            name: [captionKnowledgeBucket.bucketName],
          },
        },
      },
      targets: [
        new AwsApi({
          service: "bedrock-agent",
          action: "startIngestionJob",
          parameters: {
            knowledgeBaseId: captionKnowledgeBase.knowledgeBaseId,
            dataSourceId: captionKnowledgeSource.dataSourceId,
          },
        }),
      ],
    });

    const captionKnowledgeDeployment = new BucketDeployment(
      this,
      "captionKnowledgeDeployment",
      {
        sources: [Source.asset(path.join(__dirname, "knowledge-base"))],
        destinationBucket: captionKnowledgeBucket,
        exclude: [".DS_Store"],
        prune: true,
      }
    );

    captionKnowledgeDeployment.node.addDependency(captionIngestionRule);

    const captionInitialIngestion = new Rule(this, "captionInitialIngestion", {
      eventPattern: {
        source: ["aws.cloudformation"],
        detailType: ["CloudFormation Resource Status Change"],
        detail: {
          resourceType: ["AWS::S3::BucketDeployment"],
          resourceStatus: ["CREATE_COMPLETE", "UPDATE_COMPLETE"],
          logicalResourceId: [captionKnowledgeDeployment.node.id],
        },
      },
      targets: [
        new AwsApi({
          service: "bedrock-agent",
          action: "startIngestionJob",
          parameters: {
            knowledgeBaseId: captionKnowledgeBase.knowledgeBaseId,
            dataSourceId: captionKnowledgeSource.dataSourceId,
          },
        }),
      ],
    });

    const captionSyncChecker = new KnowledgeBaseSyncChecker(
      this,
      "captionSyncChecker",
      {
        knowledgeBaseIds: [captionKnowledgeBase.knowledgeBaseId],
        serviceName: "caption-kb-sync-checker",
        checkIntervalHours: 24,
      }
    );

    // Action group for caption generation operations
    const captionActionGroup = new AgentActionGroup({
      name: "captionGeneratorActionGroup",
      description:
        "Handles social media caption generation, fetches product data from inventory API, and creates platform-specific content.",
      executor: ActionGroupExecutor.fromlambdaFunction(executorFunction),
      apiSchema: InlineApiSchema.fromLocalAsset(
        path.join(
          __dirname,
          "..",
          "action-group",
          "caption-generator-schema.json"
        )
      ),
    });

    const model = BedrockFoundationModel.AMAZON_NOVA_LITE_V1;

    const captionInferenceProfile = CrossRegionInferenceProfile.fromConfig({
      geoRegion: CrossRegionInferenceProfileRegion.US,
      model: model,
    });

    const captionAgent = new Agent(this, "captionAgent", {
      foundationModel: captionInferenceProfile,
      instruction: readFileSync(
        path.join(__dirname, "instructions.txt"),
        "utf-8"
      ),
      knowledgeBases: [captionKnowledgeBase],
      actionGroups: [captionActionGroup],
      userInputEnabled: true,
      shouldPrepareAgent: true,
      idleSessionTTL: Duration.seconds(1800),
    });

    captionAgent.role.addToPrincipalPolicy(
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
          captionInferenceProfile.inferenceProfileArn,
          captionKnowledgeBase.knowledgeBaseArn,
        ],
      })
    );

    const captionAgentAlias = new AgentAlias(this, "alias", {
      agent: captionAgent,
    });

    const captionAgentCollaborator = new AgentCollaborator({
      agentAlias: captionAgentAlias,
      collaborationInstruction:
        "Expert in creating engaging social media captions for Instagram, Facebook, Twitter, LinkedIn, and TikTok. Generates product-specific marketing content using inventory data and provides multiple caption variations with hashtags and emojis.",
      collaboratorName: "CaptionGenerator",
      relayConversationHistory: true,
    });

    this.agentCollaborator = captionAgentCollaborator;
    this.knowledgeBaseId = captionKnowledgeBase.knowledgeBaseId;
    this.agent = captionAgent;
    this.agentAlias = captionAgentAlias;
  }
}
