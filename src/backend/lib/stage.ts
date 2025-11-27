import { Aspects, Stage, StageProps } from "aws-cdk-lib";
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { BackendStack } from "./stacks/backend";

export class ApplicationStage extends Stage {
  constructor(scope: Construct, id: string, props: StageProps) {
    super(scope, id, props);

    // Set CDK_DEFAULT_REGION for the AWS PowerTools layer
    process.env.CDK_DEFAULT_REGION = props.env?.region || "us-east-1";

    // Create backend stack with dummy URLs since we're not using frontend yet
    const backend = new BackendStack(this, "backend", {
      urls: ["http://localhost:3000"], // Temporary URL for testing
    });

    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Lambda functions require the AWSLambdaBasicExecutionRole to write logs to CloudWatch.",
          appliesTo: [
            "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
          ],
        },
        {
          id: "AwsSolutions-IAM5",
          reason:
            "High-level constructs require wildcards for dynamic resource creation and management.",
        },
        {
          id: "AwsSolutions-L1",
          reason: "High-level constructs set their own runtimes.",
        },
      ],
      true
    );
  }
}
