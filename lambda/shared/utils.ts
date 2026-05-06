import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// ── DynamoDB client ───────────────────────────────────────────────────────────

const rawClient = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_NAME = process.env.TABLE_NAME!;

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Extracts the Cognito `sub` claim (userId) from the API Gateway authorizer context.
 */
export function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims as Record<string, string> | undefined;
  const userId = claims?.['sub'];
  if (!userId) throw new Error('Missing userId in authorizer claims');
  return userId;
}

// ── HTTP response helpers ─────────────────────────────────────────────────────

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export const ok = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

export const created = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 201,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

export const noContent = (): APIGatewayProxyResult => ({
  statusCode: 204,
  headers: corsHeaders,
  body: '',
});

export const badRequest = (message: string): APIGatewayProxyResult => ({
  statusCode: 400,
  headers: corsHeaders,
  body: JSON.stringify({ message }),
});

export const conflict = (message = 'Conflict'): APIGatewayProxyResult => ({
  statusCode: 409,
  headers: corsHeaders,
  body: JSON.stringify({ message }),
});

export const notFound = (message = 'Not found'): APIGatewayProxyResult => ({
  statusCode: 404,
  headers: corsHeaders,
  body: JSON.stringify({ message }),
});

export const forbidden = (message = 'Forbidden'): APIGatewayProxyResult => ({
  statusCode: 403,
  headers: corsHeaders,
  body: JSON.stringify({ message }),
});

export const serverError = (err: unknown): APIGatewayProxyResult => {
  console.error(err);
  return {
    statusCode: 500,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Internal server error' }),
  };
};

// ── DynamoDB key helpers ──────────────────────────────────────────────────────

export const userKey            = (userId: string) => `USER#${userId}`;
export const carKey             = (carId: string)  => `CAR#${carId}`;
export const likeKey            = (userId: string) => `LIKE#${userId}`;
export const GARAGE_SETTINGS_SK  = 'GARAGE_SETTINGS';
export const CAR_ID_INDEX       = 'carId-index';
export const PUBLIC_CARS_INDEX  = 'PublicCarsIndex';
export const GSI1PK             = 'PUBLIC';
export const GSI1SK             = 'GSI1SK';
export const eventKey           = (timestamp: string, eventId: string) =>
  `EVENT#${timestamp}#${eventId}`;

// ── Authorization helper ──────────────────────────────────────────────────────

export async function assertCarOwnership(userId: string, carId: string): Promise<boolean> {
  const result = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: userKey(userId), SK: carKey(carId) },
  }));
  return !!result.Item;
}

// ── ID generation ─────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto';
export const newId = () => randomUUID();
