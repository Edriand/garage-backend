#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GarageBackendStack } from '../lib/garage-backend-stack';

const app = new cdk.App();

// Configure the environment (account and region)
// By default, it will use the AWS CLI configured account and region
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new GarageBackendStack(app, 'GarageBackendStack', {
  env,
  description: 'Garage Backend - Vehicle management and workshop platform',
  
  // Add tags to all resources in the stack
  tags: {
    Project: 'Garage',
    Environment: process.env.ENVIRONMENT || 'dev',
    ManagedBy: 'CDK',
  },
});

// Add stack-level tags
cdk.Tags.of(app).add('Application', 'GarageBackend');
