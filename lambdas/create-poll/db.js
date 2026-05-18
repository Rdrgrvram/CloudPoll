/**
 * db.js — Cliente DynamoDB compartido
 * Cuando DYNAMODB_ENDPOINT está definido (modo local), inyecta credenciales
 * ficticias porque DynamoDB Local no valida tokens reales.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;

const clientConfig = isLocal
  ? {
      endpoint: process.env.DYNAMODB_ENDPOINT,
      region: "us-east-1",
      credentials: {
        accessKeyId: "local",
        secretAccessKey: "local",
      },
    }
  : {};

export const db = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));
