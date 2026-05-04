import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Importamos los componentes de API Gateway
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from '@aws-cdk/aws-s3'; // S3 para almacenamiento de assets
import { Table } from 'aws-cdk-lib/aws-dynamodb';

interface GarageBackendStackProps extends cdk.StackProps {
  carTable: Table;
}

export class GarageBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GarageBackendStackProps) {
    super(scope, id, props);

    // Obtenemos los recursos existentes
    const userPool = cognito.UserPool.fromUserPoolId(this, 'UserPool', '{existing_user_pool_id}');
    props.carTable.grantReadWriteData(cognito.AwsAuthenticator.userGroups(['Admins']));

    // Creamos la API Gateway con un Cognito Authorizer configurado
    const api = new apigateway.RestApi(this, 'GarageAPI', {
      CloudWatchRole: true,
      defaultCorsPreflightOptions: { allowMethods: ['GET','POST','PUT','DELETE'] },
      restApiName: '{project_name}-{environment}-api-gateway',  // Usamos la convención de nombre
    });
    const authorizer = new apigateway.CognitoAuthorizer(this, 'CognitoAuthC', {
      cognitoUserPool: userPool,
      allowUnauthorizedAccess: false, // Rechazar accesos sin token
    });
    api.root.addMethod('ANY', new apigateway.MockIntegration({}), { authorizer });  // Endpoint raíz con autenticación

    // Agregamos rutas para los endpoints de coches
    const cars = api.root.addResource('cars');
    cars.addMethod('GET', new apigateway.LambdaIntegration(lambda.CarsHandler), { authorizer });
    cars.addProxy({ anyMethods: true, authorizer });  // Subrutas no configuradas

    cars.addResource('{carId}').addMethod('ANY', new apigateway.LambdaIntegration(lambda.CarDetailHandler));
    cars.addResource('{carId}/events').
      addGetOrHeadMethodWithResource({ authorizer });
    cars.addResource('{carId}/events/{eventId}). // Detalle de evento específico
  }
}