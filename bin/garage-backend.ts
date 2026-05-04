#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GarageBackendStack } from '../lib/garage-backend-stack';

const app = new cdk.App();

// Configure environment using AWS CLI credentials
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Create the main stack with environment configuration
const stack = new GarageBackendStack(app, 'GarageBackendStack', {
  env,
  description: 'Backend infrastructure for Garage vehicle management platform',
  
  // Stack-level tags for better resource organization and cost management
  tags: {
    Project: 'Garage',
    Environment: process.env.ENVIRONMENT || 'dev',
    ManagedBy: 'CDK',
  },
});

// Application-level tags applied to all resources
cdk.Tags.of(app).add('Application', 'garage-backend');
