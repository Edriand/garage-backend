/**
 * GET /download/presigned-url?fileKey={key}
 * Returns a presigned GET URL for downloading a file.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getUserId, ok, badRequest, forbidden, serverError } from '../shared/utils';

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);

    const fileKey = event.queryStringParameters?.fileKey;

    if (!fileKey) return badRequest('Missing required query parameter: fileKey');

    if (!fileKey.startsWith(`users/${userId}/`)) {
      return forbidden('Access denied: you can only download your own files');
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key:    fileKey,
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return ok({ downloadUrl, expiresIn: 3600 });
  } catch (err) {
    return serverError(err);
  }
};
