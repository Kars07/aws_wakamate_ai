import { Construct } from "constructs";
import { CommonStorageBucket } from "../../../common/constructs/s3";
import { CommonBucket } from "../../../common/constructs/s3";

interface StorageProps {
  urls: string[];
}

export class Storage extends Construct {
  public readonly structuredDataBucket: CommonStorageBucket;

  constructor(scope: Construct, id: string, props: StorageProps) {
    super(scope, id);

    const loggingBucket = new CommonBucket(this, "loggingBucket", {});

    this.structuredDataBucket = new CommonStorageBucket(
      this,
      "structuredDataBucket",
      {
        allowedOrigins: props.urls,
        eventBridgeEnabled: true,
        serverAccessLogsBucket: loggingBucket,
      }
    );
  }
}
