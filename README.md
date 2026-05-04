# 🚗 Garage Backend

Backend API for a vehicle management and workshop platform, built on AWS using Infrastructure as Code (IaC).

## 📋 Description

Garage Backend provides a serverless REST API for managing vehicles, workshops, and appointments. Built entirely on AWS using CDK (Cloud Development Kit), this project leverages modern cloud architecture patterns for scalability, reliability, and cost-effectiveness.

## 🏗️ Technology Stack

- **AWS CDK** - Infrastructure as Code framework
- **TypeScript** - Primary programming language
- **Amazon Cognito** - User authentication and authorization ✅
- **API Gateway** - REST API with Cognito JWT authorization ✅
- **AWS Lambda** - Serverless compute (Node.js 20, ARM64) ✅
- **Amazon DynamoDB** - Single-table NoSQL database ✅
- **Amazon S3** - File storage with presigned URLs ✅
- **CloudWatch** - Access logs and X-Ray tracing ✅

## 📁 Project Structure

```
garage-backend/
├── bin/
│   └── garage-backend.ts      # CDK app entry point with env config
├── lib/
│   └── garage-backend-stack.ts # Main infrastructure stack
├── lambda/                     # Lambda function handlers (future)
│   ├── vehicles/
│   ├── workshops/
│   └── appointments/
├── docs/                       # Documentation
│   ├── architecture.md         # System architecture overview
│   ├── data-model.md          # Database schema and design
│   └── api.md                 # API endpoints specification
├── .env.example                # Environment variables documentation
├── cdk.json                    # CDK configuration
├── package.json                # Node.js dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **AWS Account** - [Sign up](https://aws.amazon.com/)
- **AWS CLI** configured - [Installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **AWS CDK CLI** installed globally:
  ```bash
  npm install -g aws-cdk
  ```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Edriand/garage-backend.git
   cd garage-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure AWS credentials**
   
   Ensure your AWS CLI is configured with valid credentials:
   ```bash
   aws configure
   ```
   
   Or use AWS profiles:
   ```bash
   export AWS_PROFILE=your-profile-name
   ```

4. **Bootstrap CDK (first time only)**
   
   If this is your first CDK project in this AWS account/region:
   ```bash
   cdk bootstrap
   ```

### Configuration

The project uses AWS CLI credentials by default. Optionally, you can set environment variables:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your preferences
ENVIRONMENT=dev  # Options: dev, staging, prod
```

**Note:** The `.env` file is ignored by git to prevent credential leaks.

## 🛠️ Available Commands

### Development

```bash
# Compile TypeScript to JavaScript
npm run build

# Watch for changes and compile automatically
npm run watch

# Run tests
npm run test
```

### CDK Operations

```bash
# Synthesize CloudFormation template
npm run synth
# or
cdk synth

# Compare deployed stack with current state
npm run diff
# or
cdk diff

# Deploy infrastructure to AWS
npm run deploy
# or
cdk deploy

# Destroy all resources (careful!)
npm run destroy
# or
cdk destroy
```

### Useful CDK Commands

```bash
# List all stacks in the app
cdk ls

# Show the CloudFormation template
cdk synth

# Deploy specific stack
cdk deploy GarageBackendStack

# View stack outputs
cdk deploy --outputs-file outputs.json
```

## 🔐 Authentication Flow

The application uses **Amazon Cognito** for user authentication, providing secure JWT-based authentication.

### User Registration Flow

1. **Sign Up**: User provides email, password, and optional profile information
2. **Email Verification**: Cognito sends a verification code to the user's email
3. **Confirm Sign Up**: User enters the verification code to activate their account
4. **Sign In**: User can now authenticate with email and password

### Authentication Flow

1. **Login**: User sends email and password to Cognito
2. **Token Response**: Cognito returns three tokens:
   - **ID Token**: Contains user identity claims (profile info)
   - **Access Token**: Used for API authorization (1 hour validity)
   - **Refresh Token**: Used to obtain new tokens (30 days validity)
3. **API Requests**: Client includes Access Token in `Authorization: Bearer <token>` header
4. **Token Refresh**: When Access Token expires, use Refresh Token to get new tokens

### Password Policy

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- Symbols are optional

### Using the AWS CLI to Test Authentication

After deploying the stack, you can test authentication using the AWS CLI:

```bash
# Get the User Pool ID and Client ID from stack outputs
aws cloudformation describe-stacks --stack-name GarageBackendStack \
  --query 'Stacks[0].Outputs' --output table

# Sign up a new user
aws cognito-idp sign-up \
  --client-id <UserPoolClientId> \
  --username user@example.com \
  --password YourPassword123 \
  --user-attributes Name=email,Value=user@example.com

# Confirm the user (use the code sent to email)
aws cognito-idp confirm-sign-up \
  --client-id <UserPoolClientId> \
  --username user@example.com \
  --confirmation-code <code-from-email>

# Sign in and get tokens
aws cognito-idp initiate-auth \
  --client-id <UserPoolClientId> \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=user@example.com,PASSWORD=YourPassword123

# The response contains IdToken, AccessToken, and RefreshToken
```

### Frontend Integration

When integrating with a frontend application (React, Angular, Vue, etc.):

1. Use AWS Amplify library or Cognito SDK
2. Configure with User Pool ID and Client ID from stack outputs
3. Implement sign-up, sign-in, and sign-out flows
4. Store tokens securely (memory or secure storage, never localStorage for sensitive apps)
5. Include Access Token in all API requests
6. Implement automatic token refresh before expiration

Example with AWS Amplify (JavaScript):

```javascript
import { Amplify, Auth } from 'aws-amplify';

// Configure Amplify with your Cognito settings
Amplify.configure({
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_xxxxxxxxx',
    userPoolWebClientId: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
  }
});

// Sign up
await Auth.signUp({
  username: 'user@example.com',
  password: 'YourPassword123',
  attributes: {
    email: 'user@example.com',
    name: 'John Doe',
  }
});

// Sign in
const user = await Auth.signIn('user@example.com', 'YourPassword123');

// Get current session (includes tokens)
const session = await Auth.currentSession();
const accessToken = session.getAccessToken().getJwtToken();

// Use token in API requests
fetch('https://api.example.com/vehicles', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

## 🔌 API Endpoints

All endpoints require `Authorization: Bearer <access-token>` header. Requests without a valid Cognito JWT are rejected with HTTP 401.

Base URL is exported as the `ApiUrl` CloudFormation output.

### Cars

| Method | Path | Description |
| --- | --- | --- |
| GET | `/cars` | List all cars for the authenticated user |
| POST | `/cars` | Create a new car (`brand`, `model`, `year` required) |
| GET | `/cars/{carId}` | Get car detail |
| PUT | `/cars/{carId}` | Update car |
| DELETE | `/cars/{carId}` | Delete car |

### Events

| Method | Path | Description |
| --- | --- | --- |
| GET | `/cars/{carId}/events` | List events, newest first (`?limit=300&nextToken=...`) |
| POST | `/cars/{carId}/events` | Create event (`date`, `type`, `description` required) |
| GET | `/cars/{carId}/events/{eventId}` | Get event detail |
| PUT | `/cars/{carId}/events/{eventId}` | Update event |
| DELETE | `/cars/{carId}/events/{eventId}` | Delete event |

Event `type` must be one of: `mechanic`, `fuel`, `insurance`, `other`.

See [`docs/api.md`](docs/api.md) for full request/response schemas.

## 🏷️ Resource Tagging

All resources are automatically tagged for better organization:

- **Application**: `garage-backend`
- **Project**: `Garage`
- **Environment**: `dev` (or from `ENVIRONMENT` variable)
- **ManagedBy**: `CDK`

These tags help with:
- Cost allocation and tracking
- Resource organization in AWS Console
- Automated resource management
- Compliance and governance

## 🔐 Security Best Practices

- ✅ No hardcoded credentials or account IDs
- ✅ Environment-based configuration
- ✅ `.env` files excluded from version control
- ✅ AWS CLI credential management
- ✅ Cognito JWT authentication with strong password policy
- ✅ Email verification for new accounts
- ✅ Secure token management (1h access, 30d refresh)
- ✅ User Pool retention policy to prevent accidental data loss
- ✅ API Gateway Cognito authorizer — all endpoints require a valid JWT
- ✅ Request body validation via API Gateway models (400 on bad input)
- 🔜 IAM roles with least privilege (planned)

## 📊 Current Status

**Version**: 0.2.0 (API Gateway + Full Backend)

### ✅ Completed
- [x] CDK project initialization
- [x] TypeScript configuration
- [x] Project structure and environment configuration
- [x] Cognito User Pool with email authentication (Issue #4)
- [x] User Pool Client for SPA/mobile apps (Issue #4)
- [x] API Gateway REST API with Cognito JWT authorizer (Issue #5)
- [x] CORS enabled for OPTIONS, GET, POST, PUT, DELETE (Issue #5)
- [x] Resource structure: /cars, /cars/{carId}, /cars/{carId}/events, /cars/{carId}/events/{eventId} (Issue #5)
- [x] Request body validation models for Car and Event (Issue #5)
- [x] CloudWatch access logs + X-Ray tracing (Issue #5)
- [x] Stage-level throttling (50 rps, burst 100) (Issue #5)
- [x] API URL exported as CloudFormation output (Issue #5)
- [x] Lambda functions for Cars and Events CRUD (Issue #5)
- [x] DynamoDB single-table design (Issue #5)
- [x] S3 bucket for photos and documents (Issue #5)

### 🚧 Planned
- [ ] File upload/download presigned URL endpoints
- [ ] CloudWatch alarms and dashboards
- [ ] IAM roles with least privilege

## 🤝 Contributing

1. Check open issues for tasks
2. Create a feature branch: `git checkout -b feature/issue-X`
3. Make your changes following the project conventions
4. Ensure tests pass: `npm test`
5. Submit a Pull Request referencing the issue

## 📚 Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
- [AWS CDK API Reference](https://docs.aws.amazon.com/cdk/api/v2/)
- [Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [AWS Amplify Authentication](https://docs.amplify.aws/lib/auth/getting-started/q/platform/js/)
- [AWS CDK Examples](https://github.com/aws-samples/aws-cdk-examples)
- [TypeScript CDK Workshop](https://cdkworkshop.com/20-typescript.html)

## 📝 License

ISC

## 👤 Author

GitHub: [@Edriand](https://github.com/Edriand)

---

**Note**: This project is under active development. Check the issues page for planned features and current work.
