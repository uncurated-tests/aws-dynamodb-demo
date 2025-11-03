import { awsCredentialsProvider } from '@vercel/functions/oidc';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand, QueryCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { config } from 'dotenv';

config();

let docClient: DynamoDBDocumentClient | null = null;

export async function getClient() {
  if (docClient) {
    return docClient;
  }

  try {
    const credentials = await awsCredentialsProvider();
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials,
    });
    docClient = DynamoDBDocumentClient.from(client);
    return docClient;
  } catch (error) {
    console.error('Failed to create DynamoDB client:', error);
    throw error;
  }
}

export async function batchWriteItems(items: any[]) {
  const client = await getClient();
  const tableName = process.env.DB_TABLE_NAME;
  
  if (!tableName) {
    throw new Error('DB_TABLE_NAME environment variable is required');
  }

  const writeRequests = items.map(item => ({
    PutRequest: { Item: item },
  }));
  
  const params = {
    RequestItems: {
      [tableName]: writeRequests,
    }
  };

  try {
    const command = new BatchWriteCommand(params);
    const data = await client.send(command);
    return data;
  } catch (error) {
    console.error('BatchWrite error:', error);
    throw error;
  }
}

export async function scanTable() {
  const client = await getClient();
  const tableName = process.env.DB_TABLE_NAME;
  
  if (!tableName) {
    throw new Error('DB_TABLE_NAME environment variable is required');
  }

  const params = {
    TableName: tableName
  };

  try {
    const command = new ScanCommand(params);
    const data = await client.send(command);
    return data;
  } catch (error) {
    console.error('Scan error:', error);
    throw error;
  }
}
