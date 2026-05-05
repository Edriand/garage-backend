/**
 * DELETE /cars/{carId}/like
 * Removes the authenticated user's like from a public car.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, notFound, serverError,
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

    // 2. Delete LIKE item — condition ensures it existed
    try {
      await ddb.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: carKey(carId),
          SK: likeKey(userId),
        },
        ConditionExpression: 'attribute_exists(PK)',
      }));
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return notFound('Like not found');
      throw err;
    }

    // 3. Atomically decrement likeCount, floored at 0
    let likeCount: number;
    try {
      const updateResult = await ddb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: carItem.PK, SK: carItem.SK },
        UpdateExpression: 'ADD likeCount :minusOne',
        ConditionExpression: 'likeCount > :zero',
        ExpressionAttributeValues: { ':minusOne': -1, ':zero': 0 },
        ReturnValues: 'UPDATED_NEW',
      }));
      likeCount = updateResult.Attributes?.likeCount ?? 0;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        likeCount = 0;
      } else {
        throw err;
      }
    }

    return ok({ likeCount });
  } catch (err) {
    return serverError(err);
  }
};
