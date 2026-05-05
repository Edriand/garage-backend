/**
 * POST /cars/{carId}/like
 * Likes a public car. Each user can like a car once; likeCount is updated atomically.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, conflict, notFound, serverError,
  carKey, likeKey, CAR_ID_INDEX,
} from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;
    if (!carId) return notFound('carId path parameter is required');

    // 1. Find car via GSI (carId + SK) to verify it exists and is public
    const carResult = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: CAR_ID_INDEX,
      KeyConditionExpression: 'carId = :carId AND SK = :sk',
      ExpressionAttributeValues: {
        ':carId': carId,
        ':sk':    carKey(carId),
      },
    }));

    const carItem = carResult.Items?.[0];
    if (!carItem || !carItem.isPublic) return notFound('Car not found');

    // 2. Put LIKE item — condition prevents duplicate likes
    try {
      await ddb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK:        carKey(carId),
          SK:        likeKey(userId),
          userId,
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }));
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return conflict('Already liked');
      throw err;
    }

    // 3. Atomically increment likeCount on the car item
    const updateResult = await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: carItem.PK, SK: carItem.SK },
      UpdateExpression: 'ADD likeCount :one',
      ExpressionAttributeValues: { ':one': 1 },
      ReturnValues: 'UPDATED_NEW',
    }));

    return ok({ likeCount: updateResult.Attributes?.likeCount ?? 1 });
  } catch (err) {
    return serverError(err);
  }
};
