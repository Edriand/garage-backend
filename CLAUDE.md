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

| Segment | Values | Example |
|---|---|---|
| `projectName` | `garage-backend` | `garage-backend` |
| `version` | `v1`, `v2`, … | `v1` |
| `environment` | `dev`, `staging`, `prod` | `prod` |
| `resourceName` | short descriptor in kebab-case | `vehicles-table`, `assets-bucket` |

**Examples:**
- DynamoDB table → `garage-backend-v1-prod-vehicles-table`
- S3 bucket → `garage-backend-v1-prod-assets-bucket`
- Lambda function → `garage-backend-v1-dev-get-vehicle`
- Cognito User Pool → `garage-backend-v1-prod-user-pool`
- API Gateway → `garage-backend-v1-prod-api`

In CDK, derive the name from the `environment` context variable so it is consistent across stacks:

```typescript
const env = this.node.tryGetContext("environment") ?? "dev";
const prefix = `garage-backend-v1-${env}`;
// e.g. `${prefix}-vehicles-table`
```
