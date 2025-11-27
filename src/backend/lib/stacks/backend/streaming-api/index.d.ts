import { AmplifyData } from "@aws-amplify/data-construct";
import { Agent, AgentAlias } from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { aws_cognito as cognito } from "aws-cdk-lib";
import { Construct } from "constructs";
interface StreamingApiProps {
    userPool: cognito.UserPool;
    regionalWebAclArn: string;
    supervisorAgent: Agent;
    supervisorAgentAlias: AgentAlias;
}
export declare class StreamingApi extends Construct {
    readonly amplifiedGraphApi: AmplifyData;
    constructor(scope: Construct, id: string, props: StreamingApiProps);
}
export {};
