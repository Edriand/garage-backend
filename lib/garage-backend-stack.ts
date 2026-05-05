import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * Main stack for the Garage Backend application.
 *
 * Resources:
 * - Amazon Cognito      — User authentication (User Pool + Client)
 * - Amazon DynamoDB     — Single-table design for cars and events
 * - Amazon S3           — Asset storage (photos, documents)
 * - AWS Lambda          — One function per API endpoint (Node.js 20)
 * - Amazon API Gateway  — REST API with Cognito JWT authorization
 *
 * @see docs/architecture.md
 * @see docs/data-model.md
 * @see docs/api.md
 */
export class GarageBackendStack extends cdk.Stack {
  public readonly userPool:       cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly table:          dynamodb.Table;
  public readonly assetsBucket:   s3.Bucket;
  public readonly api:            apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── Naming prefix ────────────────────────────────────────────────────────
    const projectName    = this.node.tryGetContext('projectName')    ?? 'garage-backend';
    const projectVersion = this.node.tryGetContext('projectVersion') ?? 'v1';
    const env            = this.node.tryGetContext('environment')    ?? 'dev';
    const prefix         = `${projectName}-${projectVersion}-${env}`;

    // ========================================================================
    // Amazon Cognito
    // ========================================================================

    this.userPool = new cognito.UserPool(this, 'GarageUserPool', {
      userPoolName: `${prefix}-user-pool`,
      signInAliases:     { email: true, username: false },
      autoVerify:        { email: true },
      standardAttributes: {
        email:             { required: true,  mutable: true },
        fullname:          { required: false, mutable: true },
        preferredUsername: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength:            8,
        requireLowercase:     true,
        requireUppercase:     true,
        requireDigits:        true,
        requireSymbols:       false,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery:  cognito.AccountRecovery.EMAIL_ONLY,
      selfSignUpEnabled: true,
      email:            cognito.UserPoolEmail.withCognito(),
      removalPolicy:    cdk.RemovalPolicy.RETAIN,
      featurePlan:  cognito.FeaturePlan.ESSENTIALS,
      signInPolicy: {
        allowedFirstAuthFactors: {
          password: true,
          emailOtp: true,
        },
      },
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'GarageUserPoolClient', {
      userPool:           this.userPool,
      userPoolClientName: `${prefix}-web-client`,
      generateSecret:     false,
      authFlows: {
        userPassword: true,
        userSrp:      true,
        custom:       false,
        adminUserPassword: false,
      },
      accessTokenValidity:  cdk.Duration.hours(1),
      idTokenValidity:      cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
      enableTokenRevocation:      true,
    });

    // ALLOW_USER_AUTH is not yet in the L2 AuthFlow interface — add via escape hatch
    const cfnClient = this.userPoolClient.node.defaultChild as cognito.CfnUserPoolClient;
    cfnClient.addPropertyOverride('ExplicitAuthFlows', [
      'ALLOW_USER_PASSWORD_AUTH',
      'ALLOW_USER_SRP_AUTH',
      'ALLOW_USER_AUTH',
      'ALLOW_REFRESH_TOKEN_AUTH',
    ]);
    // OAuth not needed — client uses direct auth flows only
    cfnClient.addPropertyOverride('AllowedOAuthFlowsUserPoolClient', false);

    // ========================================================================
    // Amazon DynamoDB — single-table design
    // ========================================================================

    this.table = new dynamodb.Table(this, 'GarageTable', {
      tableName:     `${prefix}-vehicles-table`,
      partitionKey:  { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey:       { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode:   dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // ========================================================================
    // Amazon S3 — photos and documents
    // ========================================================================

    this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName:        `${prefix}-assets-bucket`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption:        s3.BucketEncryption.S3_MANAGED,
      versioned:         false,
      removalPolicy:     cdk.RemovalPolicy.RETAIN,
      cors: [{
        allowedMethods:  [s3.HttpMethods.GET, s3.HttpMethods.PUT],
        allowedOrigins:  ['*'],
        allowedHeaders:  ['*'],
        maxAge:          3000,
      }],
    });

    // ========================================================================
    // Lambda shared environment & permissions
    // ========================================================================

    const lambdaEnv: Record<string, string> = {
      TABLE_NAME:   this.table.tableName,
      BUCKET_NAME:  this.assetsBucket.bucketName,
      NODE_OPTIONS: '--enable-source-maps',
    };

    const lambdaDefaults: Partial<lambdaNodejs.NodejsFunctionProps> = {
      runtime:      lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      timeout:      cdk.Duration.seconds(10),
      memorySize:   256,
      environment:  lambdaEnv,
      bundling: {
        minify:    true,
        sourceMap: true,
      },
    };

    // ── Helper: create a NodejsFunction ──────────────────────────────────────

    const fn = (id: string, entryRelative: string, name: string): lambdaNodejs.NodejsFunction => {
      const f = new lambdaNodejs.NodejsFunction(this, id, {
        ...lambdaDefaults,
        functionName: `${prefix}-${name}`,
        entry: path.join(__dirname, '..', entryRelative),
      });
      this.table.grantReadWriteData(f);
      this.assetsBucket.grantReadWrite(f);
      return f;
    };

    // ── Cars Lambda functions ─────────────────────────────────────────────────

    const listCars   = fn('ListCars',   'lambda/cars/list.ts',   'list-cars');
    const createCar  = fn('CreateCar',  'lambda/cars/create.ts', 'create-car');
    const getCar     = fn('GetCar',     'lambda/cars/get.ts',    'get-car');
    const updateCar  = fn('UpdateCar',  'lambda/cars/update.ts', 'update-car');
    const deleteCar  = fn('DeleteCar',  'lambda/cars/delete.ts', 'delete-car');

    // ── Garage Lambda functions ───────────────────────────────────────────────

    const getGarage    = fn('GetGarage',    'lambda/garage/get.ts',    'get-garage');
    const updateGarage = fn('UpdateGarage', 'lambda/garage/update.ts', 'update-garage');

    // ── Events Lambda functions ───────────────────────────────────────────────

    const listEvents   = fn('ListEvents',   'lambda/events/list.ts',   'list-events');
    const createEvent  = fn('CreateEvent',  'lambda/events/create.ts', 'create-event');
    const getEvent     = fn('GetEvent',     'lambda/events/get.ts',    'get-event');
    const updateEvent  = fn('UpdateEvent',  'lambda/events/update.ts', 'update-event');
    const deleteEvent  = fn('DeleteEvent',  'lambda/events/delete.ts', 'delete-event');

    // ========================================================================
    // Amazon API Gateway REST API
    // ========================================================================

    const apiLogGroup = new logs.LogGroup(this, 'GarageApiLogGroup', {
      logGroupName:  `/aws/apigateway/${prefix}-api`,
      retention:     logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.api = new apigateway.RestApi(this, 'GarageApi', {
      restApiName:    `${prefix}-api`,
      description:    'Garage Backend REST API',
      cloudWatchRole: true,
      deployOptions: {
        stageName:            env,
        tracingEnabled:       true,
        dataTraceEnabled:     false,
        loggingLevel:         apigateway.MethodLoggingLevel.INFO,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat:      apigateway.AccessLogFormat.jsonWithStandardFields(),
        throttlingBurstLimit: 100,
        throttlingRateLimit:  50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'DELETE'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // ── Cognito Authorizer ────────────────────────────────────────────────────

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this, 'GarageAuthorizer', {
        cognitoUserPools:  [this.userPool],
        authorizerName:    `${prefix}-authorizer`,
        identitySource:    'method.request.header.Authorization',
        resultsCacheTtl:   cdk.Duration.minutes(5),
      },
    );

    const authOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // ── Request/Response models ───────────────────────────────────────────────

    const carModel = this.api.addModel('CarModel', {
      contentType: 'application/json',
      modelName:   'Car',
      schema: {
        schema:   apigateway.JsonSchemaVersion.DRAFT4,
        type:     apigateway.JsonSchemaType.OBJECT,
        required: ['brand', 'model', 'year', 'registrationYear', 'totalKm', 'totalInvested'],
        properties: {
          brand:            { type: apigateway.JsonSchemaType.STRING },
          model:            { type: apigateway.JsonSchemaType.STRING },
          year:             { type: apigateway.JsonSchemaType.INTEGER },
          registrationYear: { type: apigateway.JsonSchemaType.INTEGER },
          totalKm:          { type: apigateway.JsonSchemaType.INTEGER },
          totalInvested:    { type: apigateway.JsonSchemaType.NUMBER },
          photoKey:         { type: apigateway.JsonSchemaType.STRING },
          isPublic:         { type: apigateway.JsonSchemaType.BOOLEAN },
        },
      },
    });

    const eventModel = this.api.addModel('EventModel', {
      contentType: 'application/json',
      modelName:   'Event',
      schema: {
        schema:   apigateway.JsonSchemaVersion.DRAFT4,
        type:     apigateway.JsonSchemaType.OBJECT,
        required: ['date', 'type', 'description'],
        properties: {
          date:        { type: apigateway.JsonSchemaType.STRING },
          type:        { type: apigateway.JsonSchemaType.STRING, enum: ['mechanic', 'fuel', 'insurance', 'other'] },
          description: { type: apigateway.JsonSchemaType.STRING },
          amount:      { type: apigateway.JsonSchemaType.NUMBER },
        },
      },
    });

    const carUpdateModel = this.api.addModel('CarUpdateModel', {
      contentType: 'application/json',
      modelName:   'CarUpdate',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        type:   apigateway.JsonSchemaType.OBJECT,
        properties: {
          brand:            { type: apigateway.JsonSchemaType.STRING },
          model:            { type: apigateway.JsonSchemaType.STRING },
          year:             { type: apigateway.JsonSchemaType.INTEGER },
          registrationYear: { type: apigateway.JsonSchemaType.INTEGER },
          totalKm:          { type: apigateway.JsonSchemaType.INTEGER },
          totalInvested:    { type: apigateway.JsonSchemaType.NUMBER },
          photoKey:         { type: apigateway.JsonSchemaType.STRING },
          isPublic:         { type: apigateway.JsonSchemaType.BOOLEAN },
        },
      },
    });

    const garageUpdateModel = this.api.addModel('GarageUpdateModel', {
      contentType: 'application/json',
      modelName:   'GarageUpdate',
      schema: {
        schema:   apigateway.JsonSchemaVersion.DRAFT4,
        type:     apigateway.JsonSchemaType.OBJECT,
        required: ['isPublic'],
        properties: {
          isPublic: { type: apigateway.JsonSchemaType.BOOLEAN },
        },
      },
    });

    const eventUpdateModel = this.api.addModel('EventUpdateModel', {
      contentType: 'application/json',
      modelName:   'EventUpdate',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        type:   apigateway.JsonSchemaType.OBJECT,
        properties: {
          type:        { type: apigateway.JsonSchemaType.STRING, enum: ['mechanic', 'fuel', 'insurance', 'other'] },
          description: { type: apigateway.JsonSchemaType.STRING },
          amount:      { type: apigateway.JsonSchemaType.NUMBER },
          photoKeys:   { type: apigateway.JsonSchemaType.ARRAY, items: { type: apigateway.JsonSchemaType.STRING } },
          docKeys:     { type: apigateway.JsonSchemaType.ARRAY, items: { type: apigateway.JsonSchemaType.STRING } },
        },
      },
    });

    const bodyValidator = new apigateway.RequestValidator(this, 'BodyValidator', {
      restApi:              this.api,
      requestValidatorName: `${prefix}-body-validator`,
      validateRequestBody:  true,
      validateRequestParameters: false,
    });

    // ── Integration helper ────────────────────────────────────────────────────

    const integration = (f: lambda.IFunction) =>
      new apigateway.LambdaIntegration(f, { proxy: true });

    // ── /garage ───────────────────────────────────────────────────────────────

    const garage = this.api.root.addResource('garage');
    garage.addMethod('GET', integration(getGarage), authOptions);
    garage.addMethod('PUT', integration(updateGarage), {
      ...authOptions,
      requestValidator: bodyValidator,
      requestModels: { 'application/json': garageUpdateModel },
    });

    // ── /cars ─────────────────────────────────────────────────────────────────

    const cars = this.api.root.addResource('cars');
    cars.addMethod('GET',  integration(listCars),  authOptions);
    cars.addMethod('POST', integration(createCar), {
      ...authOptions,
      requestValidator: bodyValidator,
      requestModels: { 'application/json': carModel },
    });

    // ── /cars/{carId} ─────────────────────────────────────────────────────────

    const car = cars.addResource('{carId}');
    car.addMethod('GET',    integration(getCar),    authOptions);
    car.addMethod('PUT',    integration(updateCar), {
      ...authOptions,
      requestValidator: bodyValidator,
      requestModels: { 'application/json': carUpdateModel },
    });
    car.addMethod('DELETE', integration(deleteCar), authOptions);

    // ── /cars/{carId}/events ──────────────────────────────────────────────────

    const events = car.addResource('events');
    events.addMethod('GET',  integration(listEvents),  authOptions);
    events.addMethod('POST', integration(createEvent), {
      ...authOptions,
      requestValidator: bodyValidator,
      requestModels: { 'application/json': eventModel },
    });

    // ── /cars/{carId}/events/{eventId} ────────────────────────────────────────

    const eventResource = events.addResource('{eventId}');
    eventResource.addMethod('GET',    integration(getEvent),    authOptions);
    eventResource.addMethod('PUT',    integration(updateEvent), {
      ...authOptions,
      requestValidator: bodyValidator,
      requestModels: { 'application/json': eventUpdateModel },
    });
    eventResource.addMethod('DELETE', integration(deleteEvent), authOptions);

    // ========================================================================
    // CloudFormation Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'UserPoolId', {
      value:       this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName:  `${prefix}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value:       this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName:  `${prefix}-user-pool-arn`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value:       this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName:  `${prefix}-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, 'TableName', {
      value:       this.table.tableName,
      description: 'DynamoDB table name',
      exportName:  `${prefix}-table-name`,
    });

    new cdk.CfnOutput(this, 'AssetsBucketName', {
      value:       this.assetsBucket.bucketName,
      description: 'S3 assets bucket name',
      exportName:  `${prefix}-assets-bucket`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value:       this.api.url,
      description: 'API Gateway base URL',
      exportName:  `${prefix}-api-url`,
    });

    new cdk.CfnOutput(this, 'ApiLogGroupName', {
      value:       apiLogGroup.logGroupName,
      description: 'CloudWatch Log Group for API Gateway access logs',
      exportName:  `${prefix}-api-log-group`,
    });
  }
}
