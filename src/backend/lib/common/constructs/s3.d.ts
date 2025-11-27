import { Bucket, BucketProps } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
type CommonBucketProps = Omit<BucketProps, "blockPublicAccess" | "enforceSSL" | "serverAccessLogsPrefix">;
export declare class CommonBucket extends Bucket {
    constructor(scope: Construct, id: string, props: CommonBucketProps);
}
interface CommonStorageBucketProps extends Omit<CommonBucketProps, "cors"> {
    allowedOrigins: string[];
    /**
     * Set a maximum length for the bucket name to avoid deployment issues.
     * S3 bucket names are limited to 63 characters.
     * Default is 45 characters to leave room for CDK-generated suffixes.
     */
    maxBucketNameLength?: number;
}
export declare class CommonStorageBucket extends CommonBucket {
    constructor(scope: Construct, id: string, props: CommonStorageBucketProps);
    /**
     * Generates a short hash string from the input string.
     * Useful for creating unique but consistent bucket name parts.
     * Made static so it can be used before super() call
     */
    private static generateShortHash;
}
export {};
