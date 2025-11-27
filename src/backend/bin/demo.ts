#!/usr/bin/env node

import "source-map-support/register";

import * as cdk from "aws-cdk-lib";

import { PresetStageType, projectConfig } from "../../../config";

import { ApplicationStage } from "../lib/stage";

const app = new cdk.App();

const stage = (app.node.tryGetContext("stage") as PresetStageType) || PresetStageType.Dev;

const account = projectConfig.accounts[stage];

new ApplicationStage(app, stage, {
  env: {
    account: account.number,
    region: account.region,
  },
});

app.synth();
