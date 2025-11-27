import { UserPool, UserPoolClient, UserPoolClientProps, UserPoolDomain, UserPoolProps } from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
export declare class LabsUserPool extends UserPool {
    readonly userPoolDomain: UserPoolDomain;
    constructor(scope: Construct, id: string, props: UserPoolProps);
}
export declare class LabsUserPoolClient extends UserPoolClient {
    constructor(scope: Construct, id: string, props: UserPoolClientProps);
}
