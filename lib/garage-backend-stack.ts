import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * Main stack for the Garage Backend application.
 * 
 * This stack will contain all the AWS resources needed for the
 * vehicle management and workshop platform backend.
 * 
 * TODO: Add resources as defined in future issues:
 * - API Gateway
 * - Lambda functions
 * - DynamoDB tables
 * - Cognito user pool
 * - etc.
 */
export class GarageBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Placeholder: Resources will be added in subsequent issues
  }
}
