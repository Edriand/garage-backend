/**
 * DELETE /cars/{carId}/like
 * Removes the authenticated user's like from a car.
 * Works even if the car has been made private after receiving the like.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, TransactWriteCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, notFound, serverError,
  carKey, likeKey, CAR_ID_INDEX,
} from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;
    if (!carId) return notFound('carId path parameter is required');

    // Find car via GSI to get its table PK/SK.
    // isPublic is intentionally NOT checked here: users must be able to unlike a car
    // that was made private after they liked it, otherwise the LIKE item becomes
    // permanently orphaned and likeCount stays inflated.
    const carResult = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: CAR_ID_INDEX,
      KeyConditionExpression: 'carId = :carId AND SK = :sk',
      ExpressionAttributeValues: { ':carId': carId, ':sk': carKey(carId) },
    }));

    const carItem = carResult.Items?.[0];
    if (!carItem) return notFound('Car not found');

    // Atomically: delete LIKE item + decrement likeCount on Car item (floor at 0).
    try {
      await ddb.send(new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName:           TABLE_NAME,
              Key:                 { PK: carKey(carId), SK: likeKey(userId) },
              ConditionExpression: 'attribute_exists(PK)',
            },
          },
          {
            Update: {
              TableName:                 TABLE_NAME,
              Key:                       { PK: carItem.PK, SK: carItem.SK },
              UpdateExpression:          'ADD likeCount :minusOne',
              ConditionExpression:       'likeCount >= :one',
              ExpressionAttributeValues: { ':minusOne': -1, ':one': 1 },
            },
          },
        ],
      }));
    } catch (err) {
      if (err instanceof TransactionCanceledException) {
        const reasons = err.CancellationReasons ?? [];
        if (reasons[0]?.Code === 'ConditionalCheckFailed') return notFound('Like not found');

        // likeCount is already 0 but the LIKE item exists — anomalous state left by data
        // inconsistency before this fix. Delete the orphaned LIKE item and report 0.
        if (reasons[1]?.Code === 'ConditionalCheckFailed') {
          await ddb.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key:       { PK: carKey(carId), SK: likeKey(userId) },
          }));
          return ok({ likeCount: 0 });
        }
      }
      throw err;
    }

    // TransactWriteItems does not support ReturnValues — fetch the updated likeCount separately.
    const updated = await ddb.send(new GetCommand({
      TableName:            TABLE_NAME,
      Key:                  { PK: carItem.PK, SK: carItem.SK },
      ProjectionExpression: 'likeCount',
    }));

    return ok({ likeCount: updated.Item?.likeCount ?? 0 });
  } catch (err) {
    return serverError(err);
  }
};
