# 🚗 Garage Backend

Backend API for a vehicle management and workshop platform, built on AWS using Infrastructure as Code (IaC).

## 📋 Description

Garage Backend provides a serverless REST API for managing vehicles, workshops, and appointments. Built entirely on AWS using CDK (Cloud Development Kit), this project leverages modern cloud architecture patterns for scalability, reliability, and cost-effectiveness.

## 🏗️ Technology Stack

- **AWS CDK** - Infrastructure as Code framework
- **TypeScript** - Primary programming language
- **Amazon Cognito** - User authentication and authorization (planned)
- **API Gateway** - REST API management (planned)
- **AWS Lambda** - Serverless compute (planned)
- **Amazon DynamoDB** - NoSQL database (planned)
- **Amazon S3** - File storage (planned)
- **CloudWatch** - Logging and monitoring (planned)

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
- 🔜 IAM roles with least privilege (planned)
- 🔜 Cognito authentication (planned)
- 🔜 API Gateway authorization (planned)

## 📊 Current Status

**Version**: 0.1.0 (Initial setup)

### ✅ Completed
- [x] CDK project initialization
- [x] TypeScript configuration
- [x] Project structure
- [x] Environment configuration
- [x] Tagging strategy
- [x] Documentation

### 🚧 In Progress / Planned
- [ ] Cognito User Pool (Issue #4)
- [ ] API Gateway REST API (Issue #5)
- [ ] Lambda functions
- [ ] DynamoDB tables
- [ ] S3 file storage
- [ ] CloudWatch monitoring

## 🤝 Contributing

1. Check open issues for tasks
2. Create a feature branch: `git checkout -b feature/issue-X`
3. Make your changes following the project conventions
4. Ensure tests pass: `npm test`
5. Submit a Pull Request referencing the issue

## 📚 Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
- [AWS CDK API Reference](https://docs.aws.amazon.com/cdk/api/v2/)
- [AWS CDK Examples](https://github.com/aws-samples/aws-cdk-examples)
- [TypeScript CDK Workshop](https://cdkworkshop.com/20-typescript.html)

## 📝 License

ISC

## 👤 Author

GitHub: [@Edriand](https://github.com/Edriand)

---

**Note**: This project is under active development. Check the issues page for planned features and current work.
