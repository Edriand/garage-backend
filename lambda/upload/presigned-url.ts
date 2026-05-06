/**
 * POST /upload/presigned-url
 * Returns a presigned PUT URL for direct S3 upload.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getUserId, ok, badRequest, serverError } from '../shared/utils';

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

interface UploadPresignedUrlBody {
  carId:       string;
  eventId?:    string;
  filename:    string;
  contentType: string;
  category:    'photo' | 'document';
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);

    if (!event.body) return badRequest('Request body is required');

    let body: UploadPresignedUrlBody;
    try {
      body = JSON.parse(event.body);
    } catch {
      return badRequest('Invalid JSON body');
    }

    const { carId, eventId, filename, contentType, category } = body;

    if (!carId || !filename || !contentType || !category) {
      return badRequest('Missing required fields: carId, filename, contentType, category');
    }

    if (filename.includes('..') || filename.includes('/')) {
      return badRequest('Invalid filename: must not contain ".." or "/"');
    }

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return badRequest(`Invalid contentType. Allowed: ${[...ALLOWED_CONTENT_TYPES].join(', ')}`);
    }

    if (category !== 'photo' && category !== 'document') {
      return badRequest('Invalid category. Must be "photo" or "document"');
    }

    const folder = category === 'photo' ? 'photos' : 'documents';
    const fileKey = eventId
      ? `users/${userId}/cars/${carId}/events/${eventId}/${folder}/${filename}`
      : `users/${userId}/cars/${carId}/${folder}/${filename}`;

    const command = new PutObjectCommand({
      Bucket:      BUCKET_NAME,
      Key:         fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return ok({ uploadUrl, fileKey, expiresIn: 300 });
  } catch (err) {
    return serverError(err);
  }
};
