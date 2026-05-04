# Garage Backend

Backend API for a vehicle management and workshop platform, built on AWS.

## 📋 Descripción

Este proyecto es un backend para exponer coches personales con historial de eventos, fotos, documentos (facturas/tickets) y gestión de gastos e información del vehículo.

## 🏗️ Stack Técnico

- **AWS CDK v2** - Infrastructure as Code
- **TypeScript** - Lenguaje de programación
- **Node.js 24+** - Runtime
- **AWS Services** - API Gateway, Lambda, DynamoDB, S3, Cognito

## 📁 Estructura del Proyecto

```
garage-backend/
├── bin/                    # Entry point del CDK app
│   └── garage-backend.ts   # Definición de la aplicación CDK
├── lib/                    # Definición de stacks y constructs
│   └── garage-backend-stack.ts
├── lambda/                 # Funciones Lambda (handlers)
│   └── .gitkeep
├── cdk.json               # Configuración del CDK
├── tsconfig.json          # Configuración de TypeScript
└── package.json           # Dependencias del proyecto
```

## 🚀 Requisitos Previos

- Node.js 24 o superior
- AWS CLI configurado con credenciales válidas
- AWS CDK CLI instalado globalmente:
  ```bash
  npm install -g aws-cdk
  ```

## 🔧 Instalación

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/Edriand/garage-backend.git
   cd garage-backend
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar variables de entorno (opcional):
   ```bash
   # Crear archivo .env si es necesario
   cp .env.example .env
   ```

## 📝 Configuración

### Variables de Entorno

El stack puede ser configurado mediante variables de entorno o contextos de CDK:

- `CDK_DEFAULT_ACCOUNT` - AWS Account ID (por defecto usa el de tu perfil AWS CLI)
- `CDK_DEFAULT_REGION` - AWS Region (por defecto usa la de tu perfil AWS CLI)

### Context Variables (cdk.json)

Puedes personalizar valores en `cdk.json` bajo la sección `context`.

## 🛠️ Comandos Básicos

### Build

Compilar el proyecto TypeScript:
```bash
npm run build
```

### Watch Mode

Compilar automáticamente en cada cambio:
```bash
npm run watch
```

### CDK Synth

Sintetizar la plantilla de CloudFormation:
```bash
npm run synth
# o
cdk synth
```

### CDK Diff

Ver diferencias antes de desplegar:
```bash
npm run diff
# o
cdk diff
```

### CDK Deploy

Desplegar el stack a AWS:
```bash
npm run deploy
# o
cdk deploy
```

Para aprobar automáticamente cambios de IAM/seguridad:
```bash
cdk deploy --require-approval never
```

### CDK Destroy

Eliminar todos los recursos del stack:
```bash
npm run destroy
# o
cdk destroy
```

### Bootstrap (Primera vez)

Si es la primera vez que usas CDK en tu cuenta/región:
```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

## 🧪 Testing

```bash
npm test
```

## 🌐 Despliegue

### Desarrollo

```bash
# Revisar cambios
npm run diff

# Desplegar
npm run deploy
```

### Producción

Para producción, se recomienda usar CI/CD con GitHub Actions o similar.

## 📚 Recursos Útiles

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [CDK API Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)
- [CDK Patterns](https://cdkpatterns.com/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

## 📄 Licencia

ISC

## 👥 Contribución

1. Crear un issue describiendo el cambio
2. Crear una rama desde `main`
3. Realizar los cambios y hacer commit
4. Abrir un Pull Request

## 🔒 Seguridad

No incluir credenciales, secrets o información sensible en el código. Usar AWS Secrets Manager o Parameter Store para gestionar secretos.
