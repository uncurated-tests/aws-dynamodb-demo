import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { awsCredentialsProvider } from '@vercel/functions/oidc';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

async function createTable() {
  const tableName = process.env.DB_TABLE_NAME;
  
  if (!tableName) {
    throw new Error('DB_TABLE_NAME environment variable is required');
  }

  const credentials = await awsCredentialsProvider();
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials,
  });

  // Check if table already exists
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`Table ${tableName} already exists`);
    return;
  } catch (error: any) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
  }

  const params = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        BillingMode: 'PAY_PER_REQUEST',
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  };

  try {
    const command = new CreateTableCommand(params);
    await client.send(command);
    console.log(`Table ${tableName} created successfully`);
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
}

createTable().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});