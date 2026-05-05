/**
 * POST /cars
 * Creates a new car for the authenticated user.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, created, badRequest, serverError,
  userKey, carKey, newId, GARAGE_SETTINGS_SK, GSI1PK, GSI1SK,
} from '../shared/utils';

interface CreateCarBody {
  brand:            string;
  model:            string;
  year:             number;
  registrationYear: number;
  totalKm:          number;
  totalInvested:    number;
  photoKey?:        string;
  isPublic?:        boolean;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);

    if (!event.body) return badRequest('Request body is required');

    let body: CreateCarBody;
    try {
      body = JSON.parse(event.body);
    } catch {
      return badRequest('Invalid JSON body');
    }

    const { brand, model, year, registrationYear, totalKm, totalInvested, photoKey, isPublic } = body;
    if (!brand || !model || !year || registrationYear === undefined || totalKm === undefined || totalInvested === undefined) {
      return badRequest('Missing required fields: brand, model, year, registrationYear, totalKm, totalInvested');
    }

    const carId    = newId();
    const now      = new Date().toISOString();

    const garageResult = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userKey(userId), SK: GARAGE_SETTINGS_SK },
    }));
    const garageIsPublic = garageResult.Item?.isPublic ?? false;
    const effectiveIsPublic = (isPublic ?? false) && garageIsPublic;

    const item: Record<string, unknown> = {
      PK:               userKey(userId),
      SK:               carKey(carId),
      carId,
      userId,
      brand,
      model,
      year,
      registrationYear,
      totalKm,
      totalInvested,
      photoKey,
      isPublic:  isPublic ?? false,
      createdAt: now,
      updatedAt: now,
    };

    if (effectiveIsPublic) {
      item[GSI1PK] = GSI1PK;
      item[GSI1SK] = `${now}#${carId}`;
    }

    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

    return created({
      carId,
      userId,
      brand,
      model,
      year,
      registrationYear,
      totalKm,
      totalInvested,
      photoUrl:  photoKey ?? null,
      isPublic:  isPublic ?? false,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    return serverError(err);
  }
};
