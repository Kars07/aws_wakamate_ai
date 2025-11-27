import { Agent, AgentAlias, AgentCollaborator } from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { Function } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
interface CaptionGeneratorSubAgentProps {
    loggingBucket: Bucket;
    executorFunction: Function;
}
export declare class CaptionGeneratorSubAgent extends Construct {
    readonly agentCollaborator: AgentCollaborator;
    readonly knowledgeBaseId: string;
    readonly agent: Agent;
    readonly agentAlias: AgentAlias;
    constructor(scope: Construct, id: string, props: CaptionGeneratorSubAgentProps);
}
export {};
