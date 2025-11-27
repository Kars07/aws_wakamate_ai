import { Agent, AgentAlias, AgentCollaborator } from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { Function } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
interface DeliveryRouteSubAgentProps {
    loggingBucket: Bucket;
    executorFunction: Function;
}
export declare class DeliveryRouteSubAgent extends Construct {
    readonly agentCollaborator: AgentCollaborator;
    readonly knowledgeBaseId: string;
    readonly agent: Agent;
    readonly agentAlias: AgentAlias;
    constructor(scope: Construct, id: string, props: DeliveryRouteSubAgentProps);
}
export {};
