/**
 * PUT /garage
 * Upserts the authenticated user's garage settings.
 * Body: { isPublic: boolean }
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, badRequest, serverError,
  userKey, garageSettingsKey,
} from '../shared/utils';

interface UpdateGarageBody {
  isPublic: boolean;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);

    if (!event.body) return badRequest('Request body is required');

    let body: UpdateGarageBody;
    try {
      body = JSON.parse(event.body);
    } catch {
      return badRequest('Invalid JSON body');
    }

    if (typeof body.isPublic !== 'boolean') {
      return badRequest('isPublic must be a boolean');
    }

    const now = new Date().toISOString();

    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK:        userKey(userId),
        SK:        garageSettingsKey(),
        isPublic:  body.isPublic,
        updatedAt: now,
      },
    }));

    return ok({
      isPublic:  body.isPublic,
      updatedAt: now,
    });
  } catch (err) {
    return serverError(err);
  }
};
