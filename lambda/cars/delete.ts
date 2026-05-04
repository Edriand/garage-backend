/**
 * DELETE /cars/{carId}
 * Deletes a car (and implicitly its events) owned by the authenticated user.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, noContent, notFound, serverError,
  userKey, carKey,
} from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;

    if (!carId) return notFound('carId path parameter is required');

    await ddb.send(new DeleteCommand({
      TableName:           TABLE_NAME,
      Key:                 { PK: userKey(userId), SK: carKey(carId) },
      ConditionExpression: 'attribute_exists(PK)',
    }));

    return noContent();
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      return notFound('Car not found');
    }
    return serverError(err);
  }
};
