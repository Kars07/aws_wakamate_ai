import { aws_cognito as cognito, aws_iam as iam, aws_lambda as lambda } from "aws-cdk-lib";
import { Construct } from "constructs";
interface AuthProps {
    urls: string[];
    hydrationFunction?: lambda.Function;
}
export declare class Auth extends Construct {
    readonly userPool: cognito.UserPool;
    readonly userPoolDomain?: cognito.UserPoolDomain;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly identityPool: cognito.CfnIdentityPool;
    readonly authenticatedRole: iam.Role;
    readonly unauthenticatedRole: iam.Role;
    readonly regionalWebAclArn: string;
    constructor(scope: Construct, id: string, props: AuthProps);
}
export {};
