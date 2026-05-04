# Architecture

## Overview

```
Client
  │
  ▼
API Gateway (REST)
  │  Authorization: Cognito JWT
  ▼
Lambda Functions
  │
  ├── DynamoDB (vehicle data + event history)
  ├── S3 (photos and documents)
  └── Cognito (user management)
```

## AWS Services

### API Gateway
- REST API with Cognito authorizer on all endpoints
- Staged deployments: `dev`, `prod`

### Lambda
- Node.js 20 runtime
- One function per endpoint (single-responsibility)
- Handlers in `lambda/{resource}/{action}.ts`

### DynamoDB
- Single table: `garage-backend-v1-{env}-vehicles-table`
- Sort key on events uses ISO timestamp for native date ordering
- GSI for querying events by date descending
- See `data-model.md` for full schema

### S3
- One bucket: `garage-backend-v1-{env}-assets-bucket`
- Structure: `users/{userId}/cars/{carId}/photos/` and `/documents/`
- Access via presigned URLs only — bucket is private

### Cognito
- User Pool with email/password auth
- JWT tokens passed as `Authorization: Bearer` header
- `userId` extracted from token claims in each Lambda

### CloudWatch
- Lambda logs auto-captured
- Alarms on error rate and p99 latency
