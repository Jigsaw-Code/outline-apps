import { OperationTimedOut } from '../model/errors';
import { timeoutPromise } from './util';

describe('timeoutPromise', () => {
  it('Executes successful promise', () => {
    timeoutPromise(Promise.resolve(1), 100, 'Test Promise').catch((err) => {
      fail(`Successful promise was timed out when it should have resolved`);
    });
    const promiseWithTime = new Promise((resolve, _) => {
      setTimeout(() => { }, 50);
      resolve(1);
    });
    timeoutPromise(promiseWithTime, 100, 'Test Promise').catch((err) => {
      fail(`Successful timed promise was timed out when it should have resolved`);
    });
  });

  it('Executes failed promise', () => {
    timeoutPromise(Promise.reject('reason'), 100, 'Test Promise').catch((err) => {
      expect(err instanceof OperationTimedOut).toBe(false);
    });
    const promiseWithTime = new Promise((resolve) => {
      setTimeout(() => { }, 50);
      resolve(1);
    });
    timeoutPromise(promiseWithTime, 100, 'Test Promise').catch((err) => {
      expect(err instanceof OperationTimedOut).toBe(false);
    });
  });

  it('Times out promise', () => {
    const promiseWithTime = new Promise((resolve) => {
      setTimeout(() => {
        resolve(1);
      }, 2000);
    });
    timeoutPromise(promiseWithTime, 100, 'Test Promise')
      .then(() => {
        fail(`Promise should have timed out but didn't`);
      })
      .catch((err) => {
        expect(err instanceof OperationTimedOut).toBe(true);
      });
  });
});
