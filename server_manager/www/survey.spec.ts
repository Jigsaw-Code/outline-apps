// Copyright 2020 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {InMemoryStorage} from '@outline/infrastructure/memory_storage';

import {OutlineSurveys} from './survey';

describe('Surveys', () => {
  it('presents data limits surveys with the correct arguments', async () => {
    const view = new FakeSurveyDialog();
    const storage = new InMemoryStorage();
    const surveys = new OutlineSurveys(view, storage, 0);

    await surveys.presentDataLimitsEnabledSurvey();
    expect(view.title).toEqual('survey-data-limits-title');
    expect(view.surveyLink).toEqual(
      'https://docs.google.com/forms/d/e/1FAIpQLSeXQ5WUHXQHlF1Ul_ViX52GjTUPlrRB_7rhwbol3dKJfM4Kiw/viewform'
    );

    await surveys.presentDataLimitsDisabledSurvey();
    expect(view.title).toEqual('survey-data-limits-title');
    expect(view.surveyLink).toEqual(
      'https://docs.google.com/forms/d/e/1FAIpQLSc2ZNx0C1a-alFlXLxhJ8jWk-WgcxqKilFoQ5ToI8HBOK9qRA/viewform'
    );
  });

  it('presents data limits surveys after the default prompt impression delay', async () => {
    const TEST_PROMPT_IMPRESSION_DELAY_MS = 750;
    const view = new FakeSurveyDialog();
    const storage = new InMemoryStorage();
    const surveys = new OutlineSurveys(
      view,
      storage,
      TEST_PROMPT_IMPRESSION_DELAY_MS
    );

    let start = Date.now();
    await surveys.presentDataLimitsEnabledSurvey();
    let delay = Date.now() - start;
    expect(delay).toBeGreaterThanOrEqual(TEST_PROMPT_IMPRESSION_DELAY_MS);

    start = Date.now();
    await surveys.presentDataLimitsDisabledSurvey();
    delay = Date.now() - start;
    expect(delay).toBeGreaterThanOrEqual(TEST_PROMPT_IMPRESSION_DELAY_MS);
  });

  it('presents data limits surveys once', async () => {
    const view = new FakeSurveyDialog();
    const storage = new InMemoryStorage();
    const surveys = new OutlineSurveys(view, storage, 0);

    await surveys.presentDataLimitsEnabledSurvey();
    expect(storage.getItem('dataLimitsEnabledSurvey')).toEqual('true');
    await surveys.presentDataLimitsDisabledSurvey();
    expect(storage.getItem('dataLimitsDisabledSurvey')).toEqual('true');

    spyOn(view, 'open');
    await surveys.presentDataLimitsEnabledSurvey();
    expect(view.open).not.toHaveBeenCalled();
    await surveys.presentDataLimitsDisabledSurvey();
    expect(view.open).not.toHaveBeenCalled();
  });

  it('does not present data limits surveys after availability date', async () => {
    const view = new FakeSurveyDialog();
    const storage = new InMemoryStorage();
    const yesterday = new Date(new Date().setDate(new Date().getDate() - 1));
    const surveys = new OutlineSurveys(view, storage, 0, yesterday);
    spyOn(view, 'open');

    await surveys.presentDataLimitsEnabledSurvey();
    expect(view.open).not.toHaveBeenCalled();
    await surveys.presentDataLimitsDisabledSurvey();
    expect(view.open).not.toHaveBeenCalled();
  });
});

class FakeSurveyDialog implements polymer.Base {
  title: string;
  surveyLink: string;
  is: 'fake-survey-dialog';
  localize(messageId: string) {
    return messageId;
  }
  open(title: string, surveyLink: string) {
    this.title = title;
    this.surveyLink = surveyLink;
  }
}
