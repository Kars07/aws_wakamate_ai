export enum PresetStageType {
  Dev = "dev",
  Prod = "prod",
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

export const projectConfig: ProjectConfig = {
  projectId: "wakamate",
  accounts: {
    [PresetStageType.Dev]: {
      number: "024230653186", // Replace with your account ID
      region: "us-east-1", // Choose your region
    },
    [PresetStageType.Prod]: {
      number: "024230653186",
      region: "us-east-1",
    },
  },
  codePipeline: false, // Set to true if using CI/CD
};
