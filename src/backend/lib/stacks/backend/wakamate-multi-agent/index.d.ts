import { Agent, AgentAlias } from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { DeliveryRouteSubAgent } from "./delivery_route";
import { CaptionGeneratorSubAgent } from "./caption_generator";
import { InventorySubAgent } from "./inventory";
interface WakamateMultiAgentProps {
    structuredDataBucket: Bucket;
    apiBaseUrl: string;
    authToken: string;
}
export declare class WakamateMultiAgent extends Construct {
    readonly supervisorAgent: Agent;
    readonly supervisorAgentAlias: AgentAlias;
    readonly deliveryRouteSubAgent: DeliveryRouteSubAgent;
    readonly captionGeneratorSubAgent: CaptionGeneratorSubAgent;
    readonly inventorySubAgent: InventorySubAgent;
    constructor(scope: Construct, id: string, props: WakamateMultiAgentProps);
}
export {};
