/**
 * PUT /cars/{carId}
 * Updates a car owned by the authenticated user.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, badRequest, notFound, serverError,
  userKey, carKey, GARAGE_SETTINGS_SK, GSI1PK, GSI1SK,
} from '../shared/utils';

type UpdateableCarFields = {
  brand?:            string;
  model?:            string;
  year?:             number;
  registrationYear?: number;
  photoKey?:         string;
  isPublic?:         boolean;
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;

    if (!carId) return notFound('carId path parameter is required');
    if (!event.body) return badRequest('Request body is required');

    let body: UpdateableCarFields;
    try {
      body = JSON.parse(event.body);
    } catch {
      return badRequest('Invalid JSON body');
    }

    const allowedFields: (keyof UpdateableCarFields)[] = [
      'brand', 'model', 'year', 'registrationYear', 'photoKey', 'isPublic',
    ];

    const updates = allowedFields.filter(f => body[f] !== undefined);
    if (updates.length === 0) return badRequest('No valid fields to update');

    const now = new Date().toISOString();

    const currentCar = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userKey(userId), SK: carKey(carId) },
    }));
    if (!currentCar.Item) return notFound('Car not found');

    const previousIsPublic = currentCar.Item.isPublic ?? false;
    const garageResult = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userKey(userId), SK: GARAGE_SETTINGS_SK },
    }));
    const garageIsPublic = garageResult.Item?.isPublic ?? false;
    const previousEffectiveIsPublic = previousIsPublic && garageIsPublic;

    const newIsPublic = body.isPublic !== undefined ? body.isPublic : previousIsPublic;
    const newEffectiveIsPublic = newIsPublic && garageIsPublic;

    const setExpressions: string[] = [];
    const removeExpressions: string[] = [];
    const exprNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown> = { ':updatedAt': now };

    updates.forEach((field, i) => {
      exprNames[`#f${i}`] = field;
      exprValues[`:v${i}`] = body[field];
      setExpressions.push(`#f${i} = :v${i}`);
    });

    if (previousEffectiveIsPublic && !newEffectiveIsPublic) {
      exprNames['#gsi1pk'] = GSI1PK;
      removeExpressions.push('#gsi1pk', GSI1SK);
    } else if (!previousEffectiveIsPublic && newEffectiveIsPublic) {
      exprNames['#gsi1pk'] = GSI1PK;
      setExpressions.push(`#gsi1pk = :gsi1pk`, `${GSI1SK} = :gsi1sk`);
      exprValues[':gsi1pk'] = GSI1PK;
      exprValues[':gsi1sk'] = `${now}#${carId}`;
    }

    // updatedAt always goes in SET, never in REMOVE
    setExpressions.push('#updatedAt = :updatedAt');

    let updateExpression = `SET ${setExpressions.join(', ')}`;
    if (removeExpressions.length > 0) {
      updateExpression += ` REMOVE ${removeExpressions.join(', ')}`;
    }

    const result = await ddb.send(new UpdateCommand({
      TableName:                 TABLE_NAME,
      Key:                       { PK: userKey(userId), SK: carKey(carId) },
      UpdateExpression:          updateExpression,
      ExpressionAttributeNames:  exprNames,
      ExpressionAttributeValues: exprValues,
      ConditionExpression:       'attribute_exists(PK)',
      ReturnValues:              'ALL_NEW',
    }));

    const item = result.Attributes!;
    return ok({
      carId:            item.carId,
      userId:           item.userId,
      brand:            item.brand,
      model:            item.model,
      year:             item.year,
      registrationYear: item.registrationYear,
      photoUrl:         item.photoKey ?? null,
      isPublic:         item.isPublic ?? false,
      createdAt:        item.createdAt,
      updatedAt:        item.updatedAt,
    });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      return notFound('Car not found');
    }
    return serverError(err);
  }
};
