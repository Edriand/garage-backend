/**
 * DELETE /cars/{carId}
 * Deletes a car and all its events owned by the authenticated user.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, BatchWriteCommand, DeleteCommand, NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, noContent, notFound, serverError,
  userKey, carKey, assertCarOwnership,
} from '../shared/utils';

const BATCH_SIZE     = 25;
const BACKOFF_BASE   = 50;   // ms
const BACKOFF_MAX    = 1000; // ms

type DeleteRequestItem = { DeleteRequest: { Key: Record<string, NativeAttributeValue> } };

async function batchDeleteWithRetry(keys: Array<{ PK: string; SK: string }>): Promise<void> {
  let pending: DeleteRequestItem[] = keys.map(key => ({
    DeleteRequest: { Key: key as Record<string, NativeAttributeValue> },
  }));
  let delay = BACKOFF_BASE;

  while (pending.length > 0) {
    const result = await ddb.send(new BatchWriteCommand({
      RequestItems: { [TABLE_NAME]: pending },
    }));

    pending = (result.UnprocessedItems?.[TABLE_NAME] ?? []) as DeleteRequestItem[];

    if (pending.length > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, BACKOFF_MAX);
    }
  }
}

async function deleteAllCarEvents(carId: string): Promise<void> {
  let exclusiveStartKey: Record<string, NativeAttributeValue> | undefined;

  do {
    const result = await ddb.send(new QueryCommand({
      TableName:                 TABLE_NAME,
      KeyConditionExpression:    'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: { ':pk': carKey(carId), ':skPrefix': 'EVENT#' },
      ProjectionExpression:      'PK, SK',
      ExclusiveStartKey:         exclusiveStartKey,
    }));

    const keys = (result.Items ?? []).map(item => ({
      PK: item.PK as string,
      SK: item.SK as string,
    }));

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      await batchDeleteWithRetry(keys.slice(i, i + BATCH_SIZE));
    }

    exclusiveStartKey = result.LastEvaluatedKey;
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
