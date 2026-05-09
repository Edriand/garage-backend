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
  photoKey?: string;
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

    const exprParts  = ['#isPublic = :isPublic', '#updatedAt = :updatedAt'];
    const attrNames: Record<string, string>  = { '#isPublic': 'isPublic', '#updatedAt': 'updatedAt' };
    const attrValues: Record<string, unknown> = { ':isPublic': body.isPublic, ':updatedAt': now };

    if (body.photoKey !== undefined) {
      if (body.photoKey !== null && !body.photoKey.startsWith(`users/${userId}/profile/`)) {
        return badRequest('Invalid photoKey: must reference your own profile photo');
      }
      exprParts.push('#photoKey = :photoKey');
      attrNames['#photoKey']  = 'photoKey';
      attrValues[':photoKey'] = body.photoKey;
    }

    await ddb.send(new UpdateCommand({
      TableName:                 TABLE_NAME,
      Key:                       { PK: userKey(userId), SK: GARAGE_SETTINGS_SK },
      UpdateExpression:          `SET ${exprParts.join(', ')}`,
      ExpressionAttributeNames:  attrNames,
      ExpressionAttributeValues: attrValues,
    }));

    return ok({
      isPublic:  body.isPublic,
      ...(body.photoKey !== undefined && { photoKey: body.photoKey }),
      updatedAt: now,
    });
  } catch (err) {
    return serverError(err);
  }
};
