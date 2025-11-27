import { Rule } from "aws-cdk-lib/aws-events";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { Construct } from "constructs";
/**
 * Properties for the KnowledgeBaseSyncChecker construct
 */
export interface KnowledgeBaseSyncCheckerProps {
    /**
     * Knowledge base IDs to check and sync
     */
    knowledgeBaseIds: string[];
    /**
     * Name of the service for identifying the Lambda function
     * @default 'kb-sync-checker'
     */
    serviceName?: string;
    /**
     * How often to check and sync the knowledge base (in hours)
     * @default 24
     */
    checkIntervalHours?: number;
}
/**
 * A construct that creates a scheduled Lambda function to check knowledge bases
 * and trigger ingestion jobs if needed
 */
export declare class KnowledgeBaseSyncChecker extends Construct {
    /**
     * The Lambda function that checks and syncs knowledge bases
     */
    readonly syncCheckerFunction: PythonFunction;
    /**
     * The scheduled rule that triggers the Lambda function
     */
    readonly syncSchedule: Rule;
    /**
     * The name of the service for the sync checker
     */
    readonly serviceName: string;
    constructor(scope: Construct, id: string, props: KnowledgeBaseSyncCheckerProps);
}
