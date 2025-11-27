import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CodeBuildStepProps } from "aws-cdk-lib/pipelines";
export declare const codeArtifactPolicies: PolicyStatement[];
export declare function applyCodeArtifactPoliciesToStep(props: CodeBuildStepProps): CodeBuildStepProps;
