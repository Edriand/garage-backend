/**
 * DELETE /cars/{carId}
 * Deletes a car, all its events, and all associated S3 assets owned by the authenticated user.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, QueryCommand, BatchWriteCommand, DeleteCommand, NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import {
  ddb, TABLE_NAME, getUserId, noContent, notFound, serverError,
  userKey, carKey,
} from '../shared/utils';

const s3 = new S3Client({});
const BUCKET_NAME  = process.env.BUCKET_NAME!;
const BATCH_SIZE   = 25;   // DynamoDB BatchWriteItem limit
const S3_BATCH     = 1000; // S3 DeleteObjects limit
const BACKOFF_BASE = 50;   // ms
const BACKOFF_MAX  = 1000; // ms

type DeleteRequestItem = { DeleteRequest: { Key: Record<string, NativeAttributeValue> } };

async function deleteS3Objects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  for (let i = 0; i < keys.length; i += S3_BATCH) {
    const chunk = keys.slice(i, i + S3_BATCH);
    await s3.send(new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: { Objects: chunk.map(k => ({ Key: k })), Quiet: true },
    }));
  }
}

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
      ProjectionExpression:      'PK, SK, photoKeys, docKeys',
      ExclusiveStartKey:         exclusiveStartKey,
    }));

    const items = result.Items ?? [];

    const s3Keys: string[] = [];
    for (const item of items) {
      s3Keys.push(...((item.photoKeys as string[]) ?? []));
      s3Keys.push(...((item.docKeys   as string[]) ?? []));
    }
    await deleteS3Objects(s3Keys);

    const dynamoKeys = items.map(item => ({ PK: item.PK as string, SK: item.SK as string }));
    for (let i = 0; i < dynamoKeys.length; i += BATCH_SIZE) {
      await batchDeleteWithRetry(dynamoKeys.slice(i, i + BATCH_SIZE));
    }

    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;

    if (!carId) return notFound('carId path parameter is required');

    const carResult = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key:       { PK: userKey(userId), SK: carKey(carId) },
    }));
    if (!carResult.Item) return notFound('Car not found');
    const carPhotoKey: string | undefined = carResult.Item.photoKey;

    await deleteAllCarEvents(carId);

    if (carPhotoKey) await deleteS3Objects([carPhotoKey]);

    await ddb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key:       { PK: userKey(userId), SK: carKey(carId) },
    }));

    return noContent();
  } catch (err: unknown) {
    return serverError(err);
  }
};
