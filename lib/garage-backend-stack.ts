import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

/**
 * Main stack for the Garage Backend application.
 * 
 * This stack contains all the AWS resources needed for the
 * vehicle management and workshop platform backend.
 * 
 * ## Resources
 * 
 * - **Amazon Cognito**: User authentication and authorization
 *   - User Pool for customer and workshop accounts
 *   - User Pool Client for API authentication
 * 
 * ## Planned Resources
 * 
 * The following resources will be added in future issues:
 * 
 * - **API Gateway** (Issue #5): REST API endpoints
 *   - REST API with Cognito authorization
 *   - Resource routes for vehicles, workshops, appointments
 *   - CORS configuration
 * 
 * - **AWS Lambda**: Serverless business logic handlers
 *   - Vehicle management functions
 *   - Workshop operations
 *   - Appointment scheduling
 * 
 * - **Amazon DynamoDB**: NoSQL database tables
 *   - Vehicles table
 *   - Workshops table
 *   - Appointments table
 *   - Users/profiles table
 * 
 * - **Amazon S3**: File storage
 *   - Vehicle photos and documents
 *   - Workshop images
 * 
 * - **Amazon CloudWatch**: Monitoring and logging
 *   - Lambda function logs
 *   - API Gateway access logs
 *   - Custom metrics and alarms
 * 
 * @see https://docs.aws.amazon.com/cdk/latest/guide/home.html
 */
export class GarageBackendStack extends cdk.Stack {
  /**
   * Cognito User Pool for user authentication.
   * Provides JWT tokens for API authorization.
   */
  public readonly userPool: cognito.UserPool;

  /**
   * Cognito User Pool Client for application access.
   * Configured for SPA/mobile without client secret.
   */
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // Amazon Cognito User Pool
    // ========================================
    
    /**
     * User Pool for managing user authentication and registration.
     * 
     * Features:
     * - Email-based login (email is username)
     * - Strong password policy (min 8 chars, uppercase, numbers)
     * - Email verification required for new accounts
     * - Standard attributes: email, name, preferred_username
     * - Self-service account recovery via email
     */
    this.userPool = new cognito.UserPool(this, 'GarageUserPool', {
      userPoolName: 'garage-user-pool',
      
      // Sign-in configuration: use email as username
      signInAliases: {
        email: true,
        username: false,
      },
      
      // Auto-verify email addresses
      autoVerify: {
        email: true,
      },
      
      // Required standard attributes
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullName: {
          required: false,
          mutable: true,
        },
        preferredUsername: {
          required: false,
          mutable: true,
        },
      },
      
      // Password policy: minimum 8 characters, require uppercase and numbers
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      
      // Account recovery: allow users to reset password via email
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      
      // Self sign-up enabled for public registration
      selfSignUpEnabled: true,
      
      // Email configuration: use Cognito's default email service
      // For production, consider using SES for better deliverability
      email: cognito.UserPoolEmail.withCognito(),
      
      // Removal policy: retain the user pool if stack is deleted
      // This prevents accidental data loss in production
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // Cognito User Pool Client
    // ========================================
    
    /**
     * User Pool Client for frontend applications (SPA/mobile).
     * 
     * Configuration:
     * - No client secret (public client for SPA/mobile apps)
     * - USER_PASSWORD_AUTH: Direct username/password authentication
     * - REFRESH_TOKEN_AUTH: Token refresh for staying logged in
     * - Token validity: 1 hour for access, 24 hours for ID, 30 days for refresh
     */
    this.userPoolClient = new cognito.UserPoolClient(this, 'GarageUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'garage-web-client',
      
      // No client secret for public clients (SPA/mobile)
      generateSecret: false,
      
      // Enable auth flows for direct login and token refresh
      authFlows: {
        userPassword: true,      // USER_PASSWORD_AUTH flow
        userSrp: true,           // SRP (Secure Remote Password) flow
        custom: false,
        adminUserPassword: false,
      },
      
      // OAuth 2.0 flows (disabled for now, can be enabled for social login)
      oAuth: {
        flows: {
          authorizationCodeGrant: false,
          implicitCodeGrant: false,
        },
      },
      
      // Token validity periods
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      
      // Prevent user existence errors (security best practice)
      preventUserExistenceErrors: true,
      
      // Enable token revocation
      enableTokenRevocation: true,
    });

    // ========================================
    // CloudFormation Outputs
    // ========================================
    
    /**
     * Export User Pool ID for use in API Gateway authorizers
     * and for client configuration.
     */
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID for authentication',
      exportName: 'GarageUserPoolId',
    });

    /**
     * Export User Pool ARN for IAM policies and resource references.
     */
    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: 'GarageUserPoolArn',
    });

    /**
     * Export User Pool Client ID for frontend application configuration.
     * This is needed for the client to initiate authentication flows.
     */
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID for application',
      exportName: 'GarageUserPoolClientId',
    });

    // ========================================
    // Future Resources
    // ========================================
    
    // TODO (Issue #5): Add API Gateway REST API with Cognito authorizer
    // TODO: Add Lambda functions in lambda/ directory
    // TODO: Add DynamoDB tables for data persistence
    // TODO: Add S3 bucket for file storage
    // TODO: Add CloudWatch alarms and monitoring
  }
}
