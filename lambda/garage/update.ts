/**
 * PUT /garage
 * Upserts the authenticated user's garage settings.
 * Body: { isPublic: boolean }
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, badRequest, serverError,
  userKey, GARAGE_SETTINGS_SK,
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

    await ddb.send(new UpdateCommand({
      TableName:        TABLE_NAME,
      Key:              { PK: userKey(userId), SK: GARAGE_SETTINGS_SK },
      UpdateExpression: 'SET #isPublic = :isPublic, #updatedAt = :updatedAt',
      ExpressionAttributeNames:  { '#isPublic': 'isPublic', '#updatedAt': 'updatedAt' },
      ExpressionAttributeValues: { ':isPublic': body.isPublic, ':updatedAt': now },
    }));

    return ok({
      isPublic:  body.isPublic,
      updatedAt: now,
    });
  } catch (err) {
    return serverError(err);
  }
};
