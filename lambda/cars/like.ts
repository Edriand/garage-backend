/**
 * POST /cars/{carId}/like
 * Likes a public car. Each user can like a car once; likeCount is updated atomically.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, conflict, notFound, serverError,
  carKey, likeKey, CAR_ID_INDEX,
} from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;
    if (!carId) return notFound('carId path parameter is required');

    // Find car via GSI to get its table PK/SK
    const carResult = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: CAR_ID_INDEX,
      KeyConditionExpression: 'carId = :carId AND SK = :sk',
      ExpressionAttributeValues: { ':carId': carId, ':sk': carKey(carId) },
    }));

    const carItem = carResult.Items?.[0];
    if (!carItem || !carItem.isPublic) return notFound('Car not found');

    // Atomically: create LIKE item + increment likeCount on Car item.
    // The Update condition re-checks isPublic inside the transaction to close the
    // race window between the GSI read above and the write below.
    try {
      await ddb.send(new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName:           TABLE_NAME,
              Item:                { PK: carKey(carId), SK: likeKey(userId), userId, createdAt: new Date().toISOString() },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Update: {
              TableName:                 TABLE_NAME,
              Key:                       { PK: carItem.PK, SK: carItem.SK },
              UpdateExpression:          'ADD likeCount :one',
              ConditionExpression:       'isPublic = :true',
              ExpressionAttributeValues: { ':one': 1, ':true': true },
            },
          },
        ],
      }));
    } catch (err) {
      if (err instanceof TransactionCanceledException) {
        const reasons = err.CancellationReasons ?? [];
        if (reasons[0]?.Code === 'ConditionalCheckFailed') return conflict('Already liked');
        if (reasons[1]?.Code === 'ConditionalCheckFailed') return notFound('Car not found');
      }
      throw err;
    }

    // TransactWriteItems does not support ReturnValues — fetch the updated likeCount separately.
    const updated = await ddb.send(new GetCommand({
      TableName:            TABLE_NAME,
      Key:                  { PK: carItem.PK, SK: carItem.SK },
      ProjectionExpression: 'likeCount',
    }));

    return ok({ likeCount: updated.Item?.likeCount ?? 1 });
  } catch (err) {
    return serverError(err);
  }
};
