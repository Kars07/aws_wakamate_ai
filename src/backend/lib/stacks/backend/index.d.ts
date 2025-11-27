import { StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CommonStack } from "../../common/constructs/stack";
interface BackendStackProps extends StackProps {
    urls: string[];
}
export declare class BackendStack extends CommonStack {
    readonly environmentVariables: Record<string, string>;
    constructor(scope: Construct, id: string, props: BackendStackProps);
}
export {};
