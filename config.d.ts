export declare enum PresetStageType {
    Dev = "dev",
    Prod = "prod"
}
export interface AccountConfig {
    number: string;
    region: string;
}
export interface ProjectConfig {
    projectId: string;
    accounts: Record<PresetStageType, AccountConfig>;
    codePipeline?: boolean;
    gitlabGroup?: string;
    gitlabProject?: string;
}
export declare const projectConfig: ProjectConfig;
