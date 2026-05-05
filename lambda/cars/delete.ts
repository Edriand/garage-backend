/**
 * DELETE /cars/{carId}
 * Deletes a car and all its events owned by the authenticated user.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, BatchWriteCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, noContent, notFound, serverError,
  userKey, carKey, assertCarOwnership,
} from '../shared/utils';

const BATCH_SIZE = 25;

async function deleteAllCarEvents(carId: string): Promise<void> {
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const result = await ddb.send(new QueryCommand({
      TableName:                 TABLE_NAME,
      KeyConditionExpression:    'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: { ':pk': carKey(carId), ':skPrefix': 'EVENT#' },
      ProjectionExpression:      'PK, SK',
      ExclusiveStartKey:         exclusiveStartKey,
    }));

    const items = result.Items ?? [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      await ddb.send(new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk.map(item => ({
            DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
          })),
        },
      }));
    }

    exclusiveStartKey = result.LastEvaluatedKey as Record<string, AttributeValue> | undefined;
  } while (exclusiveStartKey);
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;

    if (!carId) return notFound('carId path parameter is required');

    if (!await assertCarOwnership(userId, carId)) return notFound('Car not found');

    await deleteAllCarEvents(carId);

    await ddb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key:       { PK: userKey(userId), SK: carKey(carId) },
    }));

    return noContent();
  } catch (err: unknown) {
    return serverError(err);
  }
};
