import {
  Agent,
  AgentAlias,
  AgentCollaboratorType,
  BedrockFoundationModel,
  CrossRegionInferenceProfile,
  CrossRegionInferenceProfileRegion,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { Duration, CustomResource, Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { readFileSync } from "fs";
import * as path from "path";
import { CommonPythonPowertoolsFunction } from "../../../common/constructs/lambda";
import { CommonBucket } from "../../../common/constructs/s3";
import { DeliveryRouteSubAgent } from "./delivery_route";
import { CaptionGeneratorSubAgent } from "./caption_generator";
import { InventorySubAgent } from "./inventory";

interface WakamateMultiAgentProps {
  structuredDataBucket: Bucket;
  apiBaseUrl: string;
  authToken: string;
}

export class WakamateMultiAgent extends Construct {
  public readonly supervisorAgent: Agent;
  public readonly supervisorAgentAlias: AgentAlias;
  public readonly deliveryRouteSubAgent: DeliveryRouteSubAgent;
  public readonly captionGeneratorSubAgent: CaptionGeneratorSubAgent;
  public readonly inventorySubAgent: InventorySubAgent;

  constructor(scope: Construct, id: string, props: WakamateMultiAgentProps) {
    super(scope, id);

    const { structuredDataBucket, apiBaseUrl, authToken } = props;

    // Use CommonBucket for logging bucket
    const loggingBucket = new CommonBucket(this, "loggingBucket", {});

    // Create the shared executor function using CommonPythonPowertoolsFunction
    const apiExecutorFunction = new CommonPythonPowertoolsFunction(
      this,
      "apiExecutorFunction",
      {
        entry: path.join(__dirname, "action-group", "wakamate-api-executor"),
        memorySize: 1024,
        timeout: Duration.minutes(5),
        environment: {
          WAKAMATE_API_BASE_URL: apiBaseUrl,
          WAKAMATE_AUTH_TOKEN: authToken,
        },
      }
    );

    // Grant necessary permissions
    apiExecutorFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: ["*"],
      })
    );
    structuredDataBucket.grantRead(apiExecutorFunction);

    // Initialize sub-agents with proper typing
    const deliveryRouteSubAgent = new DeliveryRouteSubAgent(
      this,
      "deliveryRouteSubAgent",
      {
        loggingBucket,
        executorFunction: apiExecutorFunction,
      }
    );

    const captionGeneratorSubAgent = new CaptionGeneratorSubAgent(
      this,
      "captionGeneratorSubAgent",
      {
        loggingBucket,
        executorFunction: apiExecutorFunction,
      }
    );

    const inventorySubAgent = new InventorySubAgent(this, "inventorySubAgent", {
      loggingBucket,
      executorFunction: apiExecutorFunction,
    });

    // Extract knowledge base deployments for dependency management
    const deliveryKnowledgeDeployment = deliveryRouteSubAgent.node.tryFindChild(
      "deliveryKnowledgeDeployment"
    );
    const captionKnowledgeDeployment =
      captionGeneratorSubAgent.node.tryFindChild("captionKnowledgeDeployment");
    const inventoryKnowledgeDeployment = inventorySubAgent.node.tryFindChild(
      "inventoryKnowledgeDeployment"
    );

    // Collect knowledge base IDs
    const knowledgeBaseIds = [
      deliveryRouteSubAgent.knowledgeBaseId,
      captionGeneratorSubAgent.knowledgeBaseId,
      inventorySubAgent.knowledgeBaseId,
    ];

    // Create knowledge base sync checker using CommonPythonPowertoolsFunction
    const immediateKbSyncChecker = new CommonPythonPowertoolsFunction(
      this,
      "immediateKbSyncChecker",
      {
        entry: path.join(__dirname, "kb-sync-checker"),
        handler: "lambda_handler",
        memorySize: 256,
        timeout: Duration.seconds(60),
        environment: {
          POWERTOOLS_SERVICE_NAME: "immediate-kb-sync-checker",
        },
      }
    );

    immediateKbSyncChecker.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "bedrock:ListKnowledgeBases",
          "bedrock:GetKnowledgeBase",
          "bedrock:ListDataSources",
          "bedrock:GetDataSource",
          "bedrock:ListIngestionJobs",
          "bedrock:StartIngestionJob",
        ],
        resources: ["*"],
      })
    );

    // Trigger immediate knowledge base sync
    const triggerKnowledgeBaseSync = new AwsCustomResource(
      this,
      "TriggerKnowledgeBaseSync",
      {
        onCreate: {
          service: "Lambda",
          action: "invoke",
          parameters: {
            FunctionName: immediateKbSyncChecker.functionName,
            Payload: JSON.stringify({ knowledgeBaseIds }),
          },
          physicalResourceId: PhysicalResourceId.of(
            `kb-sync-trigger-${Date.now()}`
          ),
        },
        policy: AwsCustomResourcePolicy.fromStatements([
          new PolicyStatement({
            actions: ["lambda:InvokeFunction"],
            resources: [immediateKbSyncChecker.functionArn],
          }),
        ]),
      }
    );

    // Add dependencies only if nodes exist
    if (deliveryKnowledgeDeployment) {
      triggerKnowledgeBaseSync.node.addDependency(deliveryKnowledgeDeployment);
    }
    if (captionKnowledgeDeployment) {
      triggerKnowledgeBaseSync.node.addDependency(captionKnowledgeDeployment);
    }
    if (inventoryKnowledgeDeployment) {
      triggerKnowledgeBaseSync.node.addDependency(inventoryKnowledgeDeployment);
    }

    triggerKnowledgeBaseSync.node.addDependency(deliveryRouteSubAgent);
    triggerKnowledgeBaseSync.node.addDependency(captionGeneratorSubAgent);
    triggerKnowledgeBaseSync.node.addDependency(inventorySubAgent);

    // Determine region and create supervisor agent
    const currentRegion = Stack.of(this).region;
    console.log(`Deploying Wakamate Multi-Agent in region: ${currentRegion}`);

    const novaProModel = BedrockFoundationModel.AMAZON_NOVA_PRO_V1;

    let supervisorAgent: Agent;

    if (currentRegion === "us-east-1") {
      console.log("Deploying in us-east-1: Using direct model invocation");

      supervisorAgent = new Agent(this, "supervisorAgent", {
        foundationModel: novaProModel,
        instruction: readFileSync(
          path.join(__dirname, "instructions.txt"),
          "utf-8"
        ),
        agentCollaboration: AgentCollaboratorType.SUPERVISOR,
        agentCollaborators: [
          deliveryRouteSubAgent.agentCollaborator,
          captionGeneratorSubAgent.agentCollaborator,
          inventorySubAgent.agentCollaborator,
        ],
      });

      supervisorAgent.role.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
            "bedrock:GetFoundationModel",
          ],
          resources: [
            `arn:aws:bedrock:${currentRegion}::foundation-model/${novaProModel.modelId}`,
          ],
        })
      );
    } else {
      console.log(
        "Using cross-region inference profile for non-us-east-1 deployment"
      );

      const supervisorInferenceProfile = CrossRegionInferenceProfile.fromConfig(
        {
          geoRegion: CrossRegionInferenceProfileRegion.US,
          model: novaProModel,
        }
      );

      supervisorAgent = new Agent(this, "supervisorAgent", {
        foundationModel: supervisorInferenceProfile,
        instruction: readFileSync(
          path.join(__dirname, "instructions.txt"),
          "utf-8"
        ),
        agentCollaboration: AgentCollaboratorType.SUPERVISOR,
        agentCollaborators: [
          deliveryRouteSubAgent.agentCollaborator,
          captionGeneratorSubAgent.agentCollaborator,
          inventorySubAgent.agentCollaborator,
        ],
      });

      supervisorInferenceProfile.grantInvoke(supervisorAgent.role);
      supervisorInferenceProfile.grantProfileUsage(supervisorAgent.role);

      supervisorAgent.role.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
            "bedrock:GetInferenceProfile",
            "bedrock:GetFoundationModel",
          ],
          resources: [
            `arn:aws:bedrock:*::foundation-model/${novaProModel.modelId}`,
            supervisorInferenceProfile.inferenceProfileArn,
          ],
        })
      );
    }

    const supervisorAgentAlias = new AgentAlias(this, "alias", {
      agent: supervisorAgent,
    });

    this.supervisorAgent = supervisorAgent;
    this.supervisorAgentAlias = supervisorAgentAlias;
    this.deliveryRouteSubAgent = deliveryRouteSubAgent;
    this.captionGeneratorSubAgent = captionGeneratorSubAgent;
    this.inventorySubAgent = inventorySubAgent;
  }
}
