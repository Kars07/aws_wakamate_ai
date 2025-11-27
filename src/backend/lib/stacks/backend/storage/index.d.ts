import { Construct } from "constructs";
import { CommonStorageBucket } from "../../../common/constructs/s3";
interface StorageProps {
    urls: string[];
}
export declare class Storage extends Construct {
    readonly structuredDataBucket: CommonStorageBucket;
    constructor(scope: Construct, id: string, props: StorageProps);
}
export {};
