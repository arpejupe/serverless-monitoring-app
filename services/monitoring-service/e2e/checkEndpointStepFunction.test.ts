import * as StepFunctions from 'aws-sdk/clients/stepfunctions';
import { clearAllItems } from 'jest-e2e-serverless/lib/utils/dynamoDb';
import { stopRunningExecutions } from 'jest-e2e-serverless/lib/utils/stepFunctions';

describe('checkEndpointStepFunction', () => {
  const {
    MonitoringDataTableName: table,
    CheckEndpointStepFunctionArn: stateMachineArn,
    Region: region,
  } = require('./config.json');

  beforeEach(async () => {
    await stopRunningExecutions(region, stateMachineArn);
    await clearAllItems(region, table);
  });

  afterEach(async () => {
    await stopRunningExecutions(region, stateMachineArn);
    await clearAllItems(region, table);
  });

  test('should update dynamodb and send notification on bad endpoint', async () => {
    const stepFunctions = new StepFunctions({ region });

    const data = {
      id: 'fakePartyErrorTestId',
      logo: 'https://www.fakeParty.com/logo.png',
      name: 'Fake Party For Error Test',
      url: 'http://localhost',
    };
    await stepFunctions
      .startExecution({ stateMachineArn, input: JSON.stringify(data) })
      .promise();

    await expect({ region, stateMachineArn }).toHaveState('PersistResults');
    await expect({ region, table }).toHaveItem(
      { id: data.id },
      { ...data, status: 'ERROR', averageLatencyMs: -1 },
      false,
    );
    await expect({ region, stateMachineArn }).toHaveState('SendNotification');
  });

  test('should update dynamodb and not send notification on good endpoint', async () => {
    const stepFunctions = new StepFunctions({ region });

    const data = {
      id: 'fakePartyPassTestId',
      logo: 'https://www.fakeParty.com/logo.png',
      name: 'Fake Party For Pass Test',
      url: 'https://www.google.com',
    };
    await stepFunctions
      .startExecution({ stateMachineArn, input: JSON.stringify(data) })
      .promise();

    await expect({ region, stateMachineArn }).toHaveState('PersistResults');
    await expect({ region, table }).toHaveItem(
      { id: data.id },
      { ...data, status: 'PASS' },
      false,
    );
    await expect({ region, stateMachineArn }).toHaveState('SkipNotification');
  });
});
