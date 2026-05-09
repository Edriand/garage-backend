/**
 * GET /public/download/presigned-url?fileKey={key}
 * Returns a presigned GET URL for photos of public cars in public garages.
 * No authentication required.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  ddb, TABLE_NAME, ok, badRequest, forbidden, serverError,
  userKey, carKey, GARAGE_SETTINGS_SK,
} from '../shared/utils';

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;

// Matches: users/{userId}/cars/{carId}/...
const FILE_KEY_RE = /^users\/([^/]+)\/cars\/([^/]+)\//;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const fileKey = event.queryStringParameters?.fileKey;
    if (!fileKey) return badRequest('Missing required query parameter: fileKey');

    const match = FILE_KEY_RE.exec(fileKey);
    if (!match) return forbidden('Access denied: fileKey does not reference a car file');

    const [, userId, carId] = match;

    const [garageResult, carResult] = await Promise.all([
      ddb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: userKey(userId), SK: GARAGE_SETTINGS_SK },
      })),
      ddb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: userKey(userId), SK: carKey(carId) },
      })),
    ]);

    if (!garageResult.Item?.isPublic) return forbidden('Access denied');
    if (!carResult.Item?.isPublic)    return forbidden('Access denied');

    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey });
    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return ok({ downloadUrl, expiresIn: 3600 });
  } catch (err) {
    return serverError(err);
  }
};
