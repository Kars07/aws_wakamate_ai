import { CfnElement, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
export declare class CommonStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps);
    private capitalize;
    allocateLogicalId(element: CfnElement): string;
}
