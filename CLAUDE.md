# Garage Backend

Backend API for a vehicle management and workshop platform, built on AWS with CDK v2 and TypeScript.

## Stack

- **IaC**: AWS CDK v2 (TypeScript)
- **Compute**: AWS Lambda (Node.js 20)
- **Database**: DynamoDB (single-table design)
- **API**: API Gateway REST API
- **Auth**: Amazon Cognito User Pool
- **Storage**: S3 (photos and documents)

## Project structure

```
bin/
  garage-backend.ts     # CDK app entry point
lib/
  garage-backend-stack.ts  # Main stack
  constructs/           # Reusable CDK constructs (to be added)
lambda/                 # Lambda function handlers (to be added)
docs/
  architecture.md       # AWS architecture overview
  api.md                # API endpoints reference
  data-model.md         # DynamoDB data model
```

## Commands

```bash
npm run build     # Compile TypeScript
npm run synth     # Synthesize CloudFormation template
npm run deploy    # Deploy to AWS
npm run diff      # Show changes vs deployed stack
npm run destroy   # Tear down the stack
```

## Environment variables

| Variable | Description |
|---|---|
| `CDK_DEFAULT_ACCOUNT` | AWS account ID (set by AWS CLI) |
| `CDK_DEFAULT_REGION` | AWS region (set by AWS CLI) |
| `ENVIRONMENT` | Deployment environment: `dev`, `staging`, `prod` |
| `PROJECT_NAME` | Project name used in resource naming (default: `garage-backend`) |
| `PROJECT_VERSION` | API version used in resource naming (default: `v1`) |

## Conventions

- All Lambda handlers go in `lambda/{resource}/{action}.ts`
- CDK constructs go in `lib/constructs/`
- One stack (`GarageBackendStack`) — no cross-stack references for now
- DynamoDB uses single-table design — see `docs/data-model.md`
- All API endpoints require Cognito JWT authorization
- Pagination uses DynamoDB `LastEvaluatedKey` as `nextToken`, page size 300

## AWS resource naming

All AWS resources must follow this pattern:

```
{projectName}-{version}-{environment}-{resourceName}
```

| Segment | CDK context key | Default |
|---|---|---|
| `projectName` | `projectName` | `garage-backend` |
| `version` | `projectVersion` | `v1` |
| `environment` | `environment` | `dev` |
| `resourceName` | — | short descriptor in kebab-case |

**Examples** (with defaults):
- DynamoDB table → `garage-backend-v1-prod-vehicles-table`
- S3 bucket → `garage-backend-v1-prod-assets-bucket`
- Lambda function → `garage-backend-v1-dev-get-vehicle`
- Cognito User Pool → `garage-backend-v1-prod-user-pool`
- API Gateway → `garage-backend-v1-prod-api`

In CDK, always derive the prefix from context so every resource stays consistent:

```typescript
const projectName = this.node.tryGetContext("projectName") ?? "garage-backend";
const projectVersion = this.node.tryGetContext("projectVersion") ?? "v1";
const env = this.node.tryGetContext("environment") ?? "dev";
const prefix = `${projectName}-${projectVersion}-${env}`;
// e.g. `${prefix}-vehicles-table`
```

**Lambda functions must always set `functionName` explicitly.** Without it, CDK generates a non-deterministic name (e.g. `GarageBackendStack-CreateCar6BAF7DD5-OfupEkxHW7rb`) that breaks naming conventions and makes resources hard to identify in AWS console.

```typescript
// Always pass functionName using the shared prefix:
const f = new lambdaNodejs.NodejsFunction(this, id, {
  ...lambdaDefaults,
  functionName: `${prefix}-${name}`,   // e.g. garage-backend-v1-pro-create-car
  entry: path.join(__dirname, '..', entryRelative),
});
```

Override at deploy time:
```bash
cdk deploy -c projectName=garage-backend -c projectVersion=v2 -c environment=prod
```

## Known CDK constraints

### DynamoDB: one GSI per CloudFormation update

DynamoDB only allows one GSI creation or deletion per CloudFormation update. When adding multiple GSIs, deploy them in separate sequential `cdk deploy` runs.

**Example — adding two GSIs (`carId-index` and `PublicCarsIndex`):**

Step 1 — temporarily comment out `PublicCarsIndex` in `lib/garage-backend-stack.ts` (do **not** commit this change), then deploy:

```bash
npm run deploy -- -c environment=pro
```

Wait for `UPDATE_COMPLETE` before proceeding.

Step 2 — restore `PublicCarsIndex` (revert the comment), then deploy again:

```bash
npm run deploy -- -c environment=pro
```

The final committed code must contain all GSI definitions — the sequential split is only at the deployment level, never in the source.
